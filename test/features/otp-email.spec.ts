import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";
import { deliverOtp } from "../../apps/modules/auth/auth.controller";

const SELF = exports.default;
const SMTP = { ...env, SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_USER: "me@example.test", SMTP_FROM: "Me <me@example.test>", SMTP_PASS: "app-password" } as Env;

beforeAll(async () => {
	await seedDatabase(env.DB);
});

describe("deliverOtp", () => {
	it("skips when SMTP isn't configured", async () => {
		let called = false;
		const result = await deliverOtp("a@example.test", "123456", { ...SMTP, SMTP_PASS: "" } as Env, async () => {
			called = true;
		});
		expect(result).toBe("skipped");
		expect(called).toBe(false);
	});

	it("sends the code with the login user and the display-name sender", async () => {
		const calls: any[] = [];
		const result = await deliverOtp("a@example.test", "123456", SMTP, async (to, code, config) => {
			calls.push({ to, code, config });
		});
		expect(result).toBe("sent");
		expect(calls).toEqual([
			{
				to: "a@example.test",
				code: "123456",
				config: { host: "smtp.example.test", port: 587, user: "me@example.test", pass: "app-password", from: "Me <me@example.test>" },
			},
		]);
	});

	it("reports a failed send instead of throwing", async () => {
		const result = await deliverOtp("a@example.test", "123456", SMTP, async () => {
			throw new Error("535 Username and Password not accepted");
		});
		expect(result).toBe("failed");
	});
});

describe("Registration without SMTP (tests, local dev)", () => {
	it("still creates the account and stores a code", async () => {
		const email = `otp-${Date.now()}@example.test`;
		const res = await SELF.fetch("http://example.com/v1/api/auth/email/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, name: "Otp", password: "longenough1" }),
		});
		expect(res.status).toBe(201);
		const row = await env.DB.prepare("SELECT code FROM email_otps WHERE email = ?1 AND used = 0").bind(email).first<{ code: string }>();
		expect(row?.code).toMatch(/^\d{6}$/);
	});
});

describe("wrangler.jsonc SMTP settings", () => {
	it("logs in with a bare address and sends with a display name", async () => {
		const config = (await import("../../wrangler.jsonc?raw")).default as string;
		const user = /"SMTP_USER":\s*"([^"]*)"/.exec(config)?.[1] ?? "";
		expect(user).toMatch(/^[^<>\s]+@[^<>\s]+$/);
	});
});
