import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, PROJECT_SLUG, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("Projects API", () => {
	describe("Core", () => {
		it("GET /v1/api/projects without auth returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects?page=1&limit=10");
			expect(res.status).toBe(401);
		});

		it("GET /v1/api/projects returns paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects?page=1&limit=10", { headers: authHeaders });
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it("GET /v1/api/projects does not return unpublished projects", async () => {
			// First, create an unpublished project (admin-only)
			const slug = "unpublished-project-" + Date.now();
			await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "Unpublished Project",
					slug,
					description: "Hidden project.",
					published: false,
				}),
			});

			// Fetch the list
			const res = await SELF.fetch("http://example.com/v1/api/projects?limit=100", { headers: authHeaders });
			const body = await res.json() as { data: { slug: string; published: boolean }[] };

			// Verify it's not in the list
			const found = body.data.find(p => p.slug === slug);
			expect(found).toBeUndefined();
		});

		it("GET /v1/api/projects returns unpublished projects for admin", async () => {
			// Admin creates a draft (only admins can POST projects anyway) and
			// must be able to see it in the list — otherwise the project they
			// just created appears to vanish from the UI.
			const slug = "admin-draft-project-" + Date.now();
			await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "Admin Draft",
					slug,
					description: "Draft visible to admin.",
					published: false,
				}),
			});

			const res = await SELF.fetch("http://example.com/v1/api/projects?limit=100", { headers: adminHeaders });
			const body = await res.json() as { data: { slug: string; published: boolean }[] };
			const found = body.data.find(p => p.slug === slug);
			expect(found).toBeDefined();
			expect(found?.published).toBe(false);
		});

		it(`GET /v1/api/projects/${PROJECT_SLUG} returns project by slug`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.data).toHaveProperty("slug", PROJECT_SLUG);
			expect(body.data).toHaveProperty("title");
		});

		it("GET /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent");
			expect(res.status).toBe(404);
		});

		it("POST /v1/api/projects with valid body creates project (201) — admin", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
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
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ title: "No Slug" }),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/projects with duplicate slug returns 409", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "Duplicate",
					slug: PROJECT_SLUG,
					description: "Duplicate slug.",
				}),
			});
			expect(res.status).toBe(409);
		});

		it(`PATCH /v1/api/projects/${PROJECT_SLUG} updates the project (admin)`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`, {
				method: "PATCH",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Updated project description." }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", PROJECT_SLUG);
		});

		it("PATCH /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent", {
				method: "PATCH",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Updated." }),
			});
			expect(res.status).toBe(404);
		});

		it("DELETE /v1/api/projects/new-test-project deletes project (200) — admin", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/new-test-project", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("message");
		});

		it("DELETE /v1/api/projects/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/non-existent", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(404);
		});
	});

	/**
	 * Authorization enforcement (C3)
	 */
	describe("authorization enforcement (C3)", () => {
		it("POST /v1/api/projects as regular user returns 403", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Forbidden Project", slug: "forbidden-p", description: "nope" }),
			});
			expect(res.status).toBe(403);
		});

		it(`PATCH /v1/api/projects/${PROJECT_SLUG} as regular user returns 403`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`, {
				method: "PATCH",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Attempted takeover" }),
			});
			expect(res.status).toBe(403);
		});

		it(`DELETE /v1/api/projects/${PROJECT_SLUG} as regular user returns 403`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(403);
		});
	});

	// Project details tests live in test/features/project-details.spec.ts.

	describe("Tags (by Project)", () => {
		it(`GET /v1/api/projects/${PROJECT_SLUG}/tags returns tags for project`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/projects/${PROJECT_SLUG}/tags`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});
	});

	describe("Project Order Sequence", () => {
		it("GET /v1/api/projects/order-sequence without auth returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/order-sequence");
			expect(res.status).toBe(401);
		});

		it("GET /v1/api/projects/order-sequence returns ordered list of projects", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", { headers: authHeaders });
			expect(res.status).toBe(200);
			const list = await res.json() as any[];
			expect(Array.isArray(list)).toBe(true);
			if (list.length > 0) {
				expect(list[0]).toHaveProperty("id");
				expect(list[0]).toHaveProperty("title");
				expect(list[0]).toHaveProperty("slug");
				expect(list[0]).toHaveProperty("position");
				expect(list[0]).toHaveProperty("sequence");
			}
		});

		it("PUT /v1/api/projects/order-sequence as regular user returns 403", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", {
				method: "PUT",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["00000000-0000-4000-8000-000000000002"] }),
			});
			expect(res.status).toBe(403);
		});

		it("PUT /v1/api/projects/order-sequence with invalid body returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", {
				method: "PUT",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["not-a-valid-uuid"] }),
			});
			expect(res.status).toBe(422);
		});

		it("PUT /v1/api/projects/order-sequence with array of UUIDs updates sequence (admin)", async () => {
			const ts = Date.now();
			const createA = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: `Seq Project A ${ts}`,
					slug: `seq-proj-a-${ts}`,
					description: "Project A",
					published: true,
				}),
			});
			const projA = await createA.json() as any;

			const createB = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: `Seq Project B ${ts}`,
					slug: `seq-proj-b-${ts}`,
					description: "Project B",
					published: true,
				}),
			});
			const projB = await createB.json() as any;

			// Reorder putting B before A
			const reorderRes = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", {
				method: "PUT",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ ids: [projB.id, projA.id] }),
			});
			expect(reorderRes.status).toBe(200);
			const reorderBody = await reorderRes.json() as any;
			expect(reorderBody.updated).toBeGreaterThanOrEqual(2);

			// Check sequence GET endpoint
			const getSeqRes = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", { headers: authHeaders });
			expect(getSeqRes.status).toBe(200);
			const list = await getSeqRes.json() as any[];
			const itemB = list.find((p) => p.id === projB.id);
			const itemA = list.find((p) => p.id === projA.id);
			expect(itemB).toBeDefined();
			expect(itemA).toBeDefined();
			expect(itemB.position).toBe(0);
			expect(itemA.position).toBe(1);

			// Verify projects list also reflects this ordering
			const listRes = await SELF.fetch("http://example.com/v1/api/projects?limit=50", { headers: authHeaders });
			const listBody = await listRes.json() as { data: any[] };
			const idxB = listBody.data.findIndex((p) => p.id === projB.id);
			const idxA = listBody.data.findIndex((p) => p.id === projA.id);
			expect(idxB).toBeLessThan(idxA);
		});

		it("PATCH /v1/api/projects/order-sequence with explicit sequence assignments updates sequence (admin)", async () => {
			const ts = Date.now();
			const createRes = await SELF.fetch("http://example.com/v1/api/projects", {
				method: "POST",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: `Explicit Seq ${ts}`,
					slug: `explicit-seq-${ts}`,
					description: "Explicit Seq",
					published: true,
				}),
			});
			const proj = await createRes.json() as any;

			const patchRes = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", {
				method: "PATCH",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ sequence: [{ id: proj.id, sequence: 42 }] }),
			});
			expect(patchRes.status).toBe(200);

			const getSeqRes = await SELF.fetch("http://example.com/v1/api/projects/order-sequence", { headers: authHeaders });
			const list = await getSeqRes.json() as any[];
			const found = list.find((p) => p.id === proj.id);
			expect(found?.position).toBe(42);
			expect(found?.sequence).toBe(42);
		});

		it("PUT /v1/api/projects/sequence and /reorder aliases work as expected", async () => {
			const resSeq = await SELF.fetch("http://example.com/v1/api/projects/sequence", {
				method: "PUT",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["00000000-0000-4000-8000-000000000002"] }),
			});
			expect(resSeq.status).toBe(200);

			const resReorder = await SELF.fetch("http://example.com/v1/api/projects/reorder", {
				method: "PUT",
				headers: { ...adminHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["00000000-0000-4000-8000-000000000002"] }),
			});
			expect(resReorder.status).toBe(200);
		});
	});
});
