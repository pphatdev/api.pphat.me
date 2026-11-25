import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

/** Admin token for a user with no DB row (so no session floor applies). */
async function ghostAdminHeaders(): Promise<Record<string, string>> {
	const token = await createJwt(
		{ sub: "ghost-admin", provider: "email", email: "ghost@example.com", name: "Ghost", role: "admin" },
		env.JWT_SECRET,
	);
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function patchRole(id: string, role: unknown, headers: Record<string, string>) {
	return SELF.fetch(`http://example.com/v1/api/users/${id}/role`, {
		method: "PATCH",
		headers,
		body: JSON.stringify({ role }),
	});
}

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("Users (IAM) API", () => {
	// ==================== AUTHZ ====================
	it("GET /v1/api/users without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/users");
		expect(res.status).toBe(401);
	});

	it("GET /v1/api/users as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/users", { headers: authHeaders });
		expect(res.status).toBe(403);
	});

	it("PATCH /v1/api/users/:id/role as non-admin returns 403", async () => {
		const res = await patchRole("contributor-user-1", "admin", authHeaders);
		expect(res.status).toBe(403);
	});

	// ==================== LIST / READ ====================
	it("GET /v1/api/users as admin returns paginated users without secrets", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/users?limit=50", { headers: adminHeaders });
		expect(res.status).toBe(200);
		const body = await res.json() as { data: Array<Record<string, unknown>>; pagination: { total: number } };
		expect(body.data.length).toBeGreaterThanOrEqual(3);
		expect(body.pagination.total).toBe(body.data.length);

		const first = body.data[0];
		expect(first.role).toBe("admin");
		expect(first).toHaveProperty("emailVerified");
		expect(first).not.toHaveProperty("password_hash");
		expect(first).not.toHaveProperty("provider_id");
	});

	it("GET /v1/api/users filters by role and search", async () => {
		const byRole = await SELF.fetch("http://example.com/v1/api/users?role=admin", { headers: adminHeaders });
		const roleBody = await byRole.json() as { data: Array<{ role: string }> };
		expect(roleBody.data.length).toBeGreaterThan(0);
		expect(roleBody.data.every((u) => u.role === "admin")).toBe(true);

		const bySearch = await SELF.fetch("http://example.com/v1/api/users?search=contrib", { headers: adminHeaders });
		const searchBody = await bySearch.json() as { data: Array<{ id: string }> };
		expect(searchBody.data.map((u) => u.id)).toEqual(["contributor-user-1"]);
	});

	it("GET /v1/api/users rejects an unknown role filter", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/users?role=root", { headers: adminHeaders });
		expect(res.status).toBe(422);
	});

	it("GET /v1/api/users/:id returns the user or 404", async () => {
		const ok = await SELF.fetch("http://example.com/v1/api/users/contributor-user-1", { headers: adminHeaders });
		expect(ok.status).toBe(200);
		expect((await ok.json() as { email: string }).email).toBe("contrib@example.com");

		const missing = await SELF.fetch("http://example.com/v1/api/users/nope", { headers: adminHeaders });
		expect(missing.status).toBe(404);
	});

	// ==================== ROLE CHANGE ====================
	it("PATCH role validates the role value", async () => {
		const res = await patchRole("contributor-user-1", "superuser", adminHeaders);
		expect(res.status).toBe(422);
	});

	it("PATCH role returns 404 for an unknown user", async () => {
		const res = await patchRole("nope", "author", adminHeaders);
		expect(res.status).toBe(404);
	});

	it("PATCH role refuses to change your own role", async () => {
		const res = await patchRole("admin-user-id", "user", adminHeaders);
		expect(res.status).toBe(403);
	});

	it("PATCH role updates the role and invalidates the target's sessions", async () => {
		const res = await patchRole("contributor-user-1", "author", adminHeaders);
		expect(res.status).toBe(200);
		expect((await res.json() as { role: string }).role).toBe("author");

		const row = await env.DB
			.prepare("SELECT role, session_invalidated_at FROM users WHERE id = ?1")
			.bind("contributor-user-1")
			.first<{ role: string; session_invalidated_at: string | null }>();
		expect(row?.role).toBe("author");
		expect(row?.session_invalidated_at).not.toBeNull();
	});

	it("PATCH role refuses to demote the last admin", async () => {
		// Leave admin-user-id as the only admin.
		const { results } = await env.DB
			.prepare("SELECT id FROM users WHERE role = 'admin' AND id <> 'admin-user-id'")
			.all<{ id: string }>();
		for (const { id } of results) {
			expect((await patchRole(id, "user", adminHeaders)).status).toBe(200);
		}

		const res = await patchRole("admin-user-id", "user", await ghostAdminHeaders());
		expect(res.status).toBe(409);

		const row = await env.DB.prepare("SELECT role FROM users WHERE id = 'admin-user-id'").first<{ role: string }>();
		expect(row?.role).toBe("admin");
	});
});
