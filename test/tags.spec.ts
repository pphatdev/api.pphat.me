import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAuthHeaders, seedDatabase } from "./helpers/setup";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
    authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Tags API", () => {
	it("GET /v1/api/tags returns list of tags", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(Array.isArray(body.data)).toBe(true);
		expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
		expect(body).toHaveProperty("pagination");
	});

	it("GET /v1/api/tags/1 returns a tag by ID", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/1");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("id", 1);
		expect(body).toHaveProperty("tag");
	});

	it("GET /v1/api/tags/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/999");
		expect(res.status).toBe(404);
	});

	it("GET /v1/api/tags/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/not-a-number");
		expect(res.status).toBe(400);
	});

	it("POST /v1/api/tags with valid body creates a tag (201)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({
				tag: "new-tag",
				description: "A brand-new tag.",
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("tag", "new-tag");
		expect(body).toHaveProperty("id");
	});

	it("POST /v1/api/tags missing tag field returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ description: "No tag name." }),
		});
		expect(res.status).toBe(422);
	});

	it("PATCH /v1/api/tags/1 updates a tag", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/1", {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "Updated tag description." }),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("id", 1);
	});

	it("PATCH /v1/api/tags/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/999", {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "Should not exist." }),
		});
		expect(res.status).toBe(404);
	});

	it("PATCH /v1/api/tags/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/not-a-number", {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "Bad ID." }),
		});
		expect(res.status).toBe(400);
	});

	it("DELETE /v1/api/tags/999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/999", { method: "DELETE", headers: authHeaders });
		expect(res.status).toBe(404);
	});

	it("DELETE /v1/api/tags/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tags/not-a-number", {
			method: "DELETE",
            headers: authHeaders
		});
		expect(res.status).toBe(400);
	});
});
