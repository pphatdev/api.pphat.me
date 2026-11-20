import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("Tech Stacks API", () => {
	it("GET /v1/api/tech-stacks without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks");
		expect(res.status).toBe(401);
	});

	it("GET /v1/api/tech-stacks returns paginated list", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks?page=1&limit=10", { headers: authHeaders });
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(Array.isArray(body.data)).toBe(true);
		expect(body).toHaveProperty("pagination");
	});

	it("POST /v1/api/tech-stacks as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ name: "Should Not Create" }),
		});
		expect(res.status).toBe(403);
	});

	it("POST /v1/api/tech-stacks with valid body creates (201) — admin", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				name: "React",
				description: "A JavaScript library for building user interfaces.",
				url: "https://react.dev",
				logo_url: "https://react.dev/favicon.ico",
				cover: "https://example.com/react-cover.png",
				status: 1,
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("id");
		expect(body).toMatchObject({
			name: "React",
			url: "https://react.dev",
			logoUrl: "https://react.dev/favicon.ico",
			cover: "https://example.com/react-cover.png",
			status: 1,
		});
	});

	it("POST /v1/api/tech-stacks accepts logoUrl camelCase alias", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				name: "Vue",
				logoUrl: "https://vuejs.org/logo.svg",
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("logoUrl", "https://vuejs.org/logo.svg");
	});

	it("POST /v1/api/tech-stacks allows null cover (optional)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "Svelte" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("cover", null);
	});

	it("POST /v1/api/tech-stacks missing name returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ description: "nameless" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST /v1/api/tech-stacks with invalid status returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "Bad Status", status: 5 }),
		});
		expect(res.status).toBe(422);
	});

	it("GET /v1/api/tech-stacks/:id returns a single stack", async () => {
		const createRes = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "Hono", url: "https://hono.dev" }),
		});
		const created = await createRes.json() as { id: number };

		const res = await SELF.fetch(`http://example.com/v1/api/tech-stacks/${created.id}`);
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({ id: created.id, name: "Hono" });
	});

	it("GET /v1/api/tech-stacks/9999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks/9999");
		expect(res.status).toBe(404);
	});

	it("GET /v1/api/tech-stacks/not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks/not-a-number");
		expect(res.status).toBe(400);
	});

	it("PATCH /v1/api/tech-stacks/:id updates partially (admin)", async () => {
		const createRes = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "Astro", description: "Original" }),
		});
		const created = await createRes.json() as { id: number };

		const res = await SELF.fetch(`http://example.com/v1/api/tech-stacks/${created.id}`, {
			method: "PATCH",
			headers: adminHeaders,
			body: JSON.stringify({ description: "Updated description.", status: 0 }),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({ id: created.id, name: "Astro", description: "Updated description.", status: 0 });
	});

	it("PATCH /v1/api/tech-stacks/:id as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks/1", {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "nope" }),
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /v1/api/tech-stacks/:id (admin) returns 204 then 404 on refetch", async () => {
		const createRes = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "Ephemeral" }),
		});
		const created = await createRes.json() as { id: number };

		const delRes = await SELF.fetch(`http://example.com/v1/api/tech-stacks/${created.id}`, {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(delRes.status).toBe(204);

		const getRes = await SELF.fetch(`http://example.com/v1/api/tech-stacks/${created.id}`);
		expect(getRes.status).toBe(404);
	});

	it("DELETE /v1/api/tech-stacks/:id as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks/1", {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /v1/api/tech-stacks/9999 (admin) returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/tech-stacks/9999", {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(res.status).toBe(404);
	});
});
