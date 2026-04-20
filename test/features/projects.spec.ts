import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, PROJECT_SLUG, getAuthHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Projects API", () => {
	describe("Core", () => {
		it("GET /v1/api/projects returns paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects?page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it("GET /v1/api/projects with search param filters results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects?search=Test&page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});

		it(`GET /v1/api/projects/${PROJECT_SLUG} returns project by slug`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", PROJECT_SLUG);
			expect(body).toHaveProperty("title");
		});

		it("GET /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent");
			expect(res.status).toBe(404);
		});

		it("POST /v1/api/projects with valid body creates project (201)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "New Test Project",
					slug: "new-test-project",
					description: "A newly created project.",
					thumbnail: "https://example.com/new-proj-thumb.png",
					published: false,
					languages: ["TypeScript"],
					contributor_ids: [],
					tag_ids: [],
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", "new-test-project");
		});

		it("POST /v1/api/projects with missing required fields returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ title: "No Slug" }),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/projects with duplicate slug returns 409", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "Duplicate",
					slug: PROJECT_SLUG,
					description: "Duplicate slug.",
				}),
			});
			expect(res.status).toBe(409);
		});

		it(`PATCH /v1/api/projects/${PROJECT_SLUG} updates the project`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`, {
				method: "PATCH",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Updated project description." }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", PROJECT_SLUG);
		});

		it("PATCH /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent", {
				method: "PATCH",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Updated." }),
			});
			expect(res.status).toBe(404);
		});

		it("DELETE /v1/api/projects/new-test-project deletes project (200)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/new-test-project", {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("message");
		});

		it("DELETE /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent", {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(404);
		});
	});

	describe("Details", () => {
		it(`GET /v1/api/projects/${PROJECT_SLUG}/details returns project details`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}/details`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("projectId");
		});

		it("GET /v1/api/projects/non-existent/details returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent/details");
			expect(res.status).toBe(404);
		});
	});

	describe("Tags (by Project)", () => {
		it(`GET /v1/api/projects/${PROJECT_SLUG}/tags returns tags for project`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}/tags`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});
	});
});
