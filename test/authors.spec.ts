import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAuthHeaders, seedDatabase } from "./helpers/setup";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Authors API", () => {
	it("GET /v1/api/authors returns list of authors", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors");
		expect(res.status).toBe(200);
		const body = await res.json() as { data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThanOrEqual(1);
		expect(body.pagination).toMatchObject({
			page: 1,
			limit: 10,
		});
		expect(body.pagination.total).toBeGreaterThanOrEqual(1);
		expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1);
	});

	it("GET /v1/api/authors/1 returns an author by ID", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/1");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("id", 1);
		expect(body).toHaveProperty("name");
	});

	it("GET /v1/api/authors/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/999");
		expect(res.status).toBe(404);
	});

	it("GET /v1/api/authors/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/not-a-number");
		expect(res.status).toBe(400);
	});

	it("POST /v1/api/authors with valid body creates an author (201)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors", {
			method: "POST",
			headers: { ...authHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "New Author",
				profile: "Engineer",
				url: "https://newauthor.example.com",
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("name", "New Author");
		expect(body).toHaveProperty("id");
	});

	it("POST /v1/api/authors with missing name returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors", {
			method: "POST",
			headers: { ...authHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({ profile: "Developer" }),
		});
		expect(res.status).toBe(422);
	});

	it("PATCH /v1/api/authors/1 updates an author", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/1", {
			method: "PATCH",
			headers: { ...authHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({ profile: "Updated Profile" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("id", 1);
	});

	it("PATCH /v1/api/authors/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/999", {
			method: "PATCH",
			headers: { ...authHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({ profile: "Should Not Exist" }),
		});
		expect(res.status).toBe(404);
	});

	it("DELETE /v1/api/authors/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/999", {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(404);
	});

	it("DELETE /v1/api/authors/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/authors/not-a-number", {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(400);
	});
});
