import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAdminHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("CSP hardening (#28)", () => {
	it("script-src no longer allows 'unsafe-inline'", async () => {
		// A public GET is enough to see the response headers set by the
		// security middleware. Root `/` bypasses auth entirely.
		const res = await SELF.fetch("http://example.com/");
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("script-src");
		// script-src must NOT permit unsafe-inline; we asserted style-src
		// keeps it (Hono / Google fonts need it) so scope the check.
		const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
		expect(scriptSrc).not.toContain("'unsafe-inline'");
	});
});

describe("Chat history retention cap (#34)", () => {
	// Insert well past the CHAT_HISTORY_PER_USER_MAX cap of 500 to prove the
	// trim step actually runs during a real chat POST.
	it("saveChatHistory trims a user's rows to the 500-message cap", async () => {
		const userId = "admin-user-id"; // admin auth uses this user
		await env.DB.prepare("DELETE FROM chat_history WHERE user_id = ?1").bind(userId).run();

		// Preload 510 rows for the user so the next chat POST tips them past
		// the cap and triggers the trim.
		const stmt = env.DB.prepare(
			"INSERT INTO chat_history (user_id, role, content) VALUES (?1, ?2, ?3)",
		);
		const inserts = [];
		for (let i = 0; i < 510; i++) {
			inserts.push(stmt.bind(userId, i % 2 === 0 ? "user" : "assistant", `preload ${i}`));
		}
		await env.DB.batch(inserts);

		// Stub the AI binding so the chat POST returns immediately without
		// touching Workers AI.
		const previousAI = (env as any).AI;
		(env as any).AI = { run: async () => ({ response: "hi back" }) };

		try {
			const res = await SELF.fetch("http://example.com/v1/api/chat", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({ message: "one more message" }),
			});
			expect(res.status).toBe(200);
		} finally {
			if (previousAI === undefined) delete (env as any).AI;
			else (env as any).AI = previousAI;
		}

		const row = await env.DB.prepare(
			"SELECT COUNT(*) as n FROM chat_history WHERE user_id = ?1",
		).bind(userId).first<{ n: number }>();
		// 510 preload + 2 (user + assistant) then trimmed to 500.
		expect(row?.n).toBe(500);
	});
});

describe("PBKDF2 iteration bump (#36)", () => {
	async function register(email: string, password: string) {
		await SELF.fetch("http://example.com/v1/api/auth/email/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, name: "PBK User", password }),
		});
		const otp = await env.DB.prepare(
			"SELECT code FROM email_otps WHERE email = ?1 AND used = 0 ORDER BY created_at DESC LIMIT 1",
		).bind(email).first<{ code: string }>();
		await SELF.fetch("http://example.com/v1/api/auth/email/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, otp: otp!.code }),
		});
	}

	it("new registrations produce a pbkdf2$600000$ hash", async () => {
		const email = "pbkdf2-new@example.com";
		await register(email, "correcthorse42");
		const row = await env.DB.prepare(
			"SELECT password_hash FROM users WHERE provider_id = ?1",
		).bind(email).first<{ password_hash: string }>();
		expect(row?.password_hash).toMatch(/^pbkdf2\$600000\$/);
	});

	it("a legacy 100k hash still verifies AND is upgraded in place on next login", async () => {
		const email = "pbkdf2-legacy@example.com";
		const password = "correcthorse42";
		// Register normally, then overwrite the stored hash with a legacy-format
		// hash for the same password.
		await register(email, password);
		const legacyHash = await computeLegacyHash(password);
		await env.DB.prepare(
			"UPDATE users SET password_hash = ?1 WHERE provider_id = ?2",
		).bind(legacyHash, email).run();

		// Sanity: legacy hash was actually written.
		const before = await env.DB.prepare(
			"SELECT password_hash FROM users WHERE provider_id = ?1",
		).bind(email).first<{ password_hash: string }>();
		expect(before?.password_hash).toBe(legacyHash);
		expect(before?.password_hash).not.toMatch(/^pbkdf2\$/);

		const res = await SELF.fetch("http://example.com/v1/api/auth/email/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		expect(res.status).toBe(200);

		// After a successful login the hash must be upgraded to the versioned
		// format at 600k iterations.
		const after = await env.DB.prepare(
			"SELECT password_hash FROM users WHERE provider_id = ?1",
		).bind(email).first<{ password_hash: string }>();
		expect(after?.password_hash).toMatch(/^pbkdf2\$600000\$/);
		expect(after?.password_hash).not.toBe(legacyHash);
	});
});

/**
 * Mirror of the pre-#36 legacy hash format so the test can seed a stored
 * hash exactly like an account created before the bump. Keeps the test
 * decoupled from the (now-private) production helpers.
 */
async function computeLegacyHash(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
		keyMaterial,
		256,
	);
	const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}
