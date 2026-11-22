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

describe("Gallery API", () => {
	// ==================== PUBLIC / FEATURED / STATS ====================
	describe("GET /v1/api/gallery/public", () => {
		it("returns 200 with only public gallery items", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/public");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);

			const items = body.data as Array<{ isPublic: boolean; is_public: number }>;
			for (const item of items) {
				expect(item.isPublic).toBe(true);
				expect(item.is_public).toBe(1);
			}
		});

		it("alias GET /v1/api/galleries/public returns 200", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/galleries/public");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});
	});

	describe("GET /v1/api/gallery/featured", () => {
		it("returns 200 with featured items", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/featured");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ isFeatured: boolean; isPublic: boolean }>; total: number };
			expect(Array.isArray(body.data)).toBe(true);
			expect(body.total).toBeGreaterThan(0);
			for (const item of body.data) {
				expect(item.isFeatured).toBe(true);
				expect(item.isPublic).toBe(true);
			}
		});
	});

	describe("GET /v1/api/gallery/stats", () => {
		it("returns 200 with gallery overview statistics", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/stats");
			expect(res.status).toBe(200);

			const stats = await res.json() as {
				total: number;
				publicCount: number;
				hiddenCount: number;
				featuredCount: number;
				categoriesCount: number;
				categories: string[];
			};

			expect(typeof stats.total).toBe("number");
			expect(stats.total).toBeGreaterThanOrEqual(5);
			expect(typeof stats.publicCount).toBe("number");
			expect(typeof stats.hiddenCount).toBe("number");
			expect(typeof stats.featuredCount).toBe("number");
			expect(Array.isArray(stats.categories)).toBe(true);
			expect(stats.categories).toContain("photography");
			expect(stats.categories).toContain("design");
		});
	});

	// ==================== LIST / READ ====================
	describe("GET /v1/api/gallery (List)", () => {
		it("public request returns 200 with active public items only", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ isPublic: boolean }>; pagination: unknown };
			expect(Array.isArray(body.data)).toBe(true);
			for (const item of body.data) {
				expect(item.isPublic).toBe(true);
			}
		});

		it("admin request sees all items including hidden ones", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery?limit=-1", {
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ isPublic: boolean }> };
			const hasHidden = body.data.some((i) => !i.isPublic);
			expect(hasHidden).toBe(true);
		});

		it("filters by category", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery?category=photography", {
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ category: string }> };
			expect(body.data.length).toBeGreaterThan(0);
			for (const item of body.data) {
				expect(item.category).toBe("photography");
			}
		});

		it("filters by visibility=hidden for admin", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery?visibility=hidden", {
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ isPublic: boolean }> };
			expect(body.data.length).toBeGreaterThan(0);
			for (const item of body.data) {
				expect(item.isPublic).toBe(false);
			}
		});

		it("searches by title or tags", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery?search=Skyline");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ title: string }> };
			expect(body.data.length).toBeGreaterThan(0);
			expect(body.data[0].title).toContain("Skyline");
		});
	});

	// ==================== GET BY ID ====================
	describe("GET /v1/api/gallery/:id", () => {
		it("returns 200 with item details for public item", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/1");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(1);
			expect(body.title).toBe("Phnom Penh Skyline Dusk");
			expect(body.mediaPath).toBe("blogs/media/cover-phnom-penh.webp");
			expect(body.aspectRatio).toBe("16/9");
			expect(Array.isArray(body.tags)).toBe(true);
		});

		it("returns 404 to public caller for hidden item (item 5)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/5");
			expect(res.status).toBe(404);
		});

		it("returns 200 to admin caller for hidden item (item 5)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/5", {
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(5);
			expect(body.isPublic).toBe(false);
		});

		it("returns 400 for invalid ID format", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/invalid");
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/999999");
			expect(res.status).toBe(404);
		});
	});

	// ==================== CREATE ====================
	describe("POST /v1/api/gallery", () => {
		it("returns 401 without auth", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "New Item", mediaPath: "path.jpg" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ title: "New Item", mediaPath: "path.jpg" }),
			});
			expect(res.status).toBe(403);
		});

		it("returns 422 when required fields are missing", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({ caption: "Missing title and mediaPath" }),
			});
			expect(res.status).toBe(422);
		});

		it("admin creates single gallery item successfully (201)", async () => {
			const payload = {
				title: "Angkor Wat Sunset",
				caption: "Reflections over the moat",
				altText: "Angkor Wat reflection",
				mediaPath: "blogs/media/angkor-wat.webp",
				category: "travel",
				tags: ["angkor", "cambodia", "moat"],
				isPublic: true,
				isFeatured: true,
				sortOrder: 10,
				aspectRatio: "16/9",
			};

			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(201);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("id");
			expect(body.title).toBe("Angkor Wat Sunset");
			expect(body.mediaPath).toBe("blogs/media/angkor-wat.webp");
			expect(body.isPublic).toBe(true);
			expect(body.isFeatured).toBe(true);
			expect(body.aspectRatio).toBe("16/9");
			expect(body.tags).toEqual(["angkor", "cambodia", "moat"]);
		});

		it("admin creates bulk gallery items (201)", async () => {
			const bulk = [
				{
					title: "Bulk Item 1",
					mediaPath: "blogs/media/bulk1.webp",
					category: "photography",
				},
				{
					title: "Bulk Item 2",
					mediaPath: "blogs/media/bulk2.webp",
					category: "photography",
				},
			];

			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify(bulk),
			});
			expect(res.status).toBe(201);

			const body = await res.json() as { data: Array<{ title: string }>; count: number };
			expect(body.count).toBe(2);
			expect(body.data[0].title).toBe("Bulk Item 1");
			expect(body.data[1].title).toBe("Bulk Item 2");
		});
	});

	// ==================== UPDATE ====================
	describe("PUT / PATCH /v1/api/gallery/:id", () => {
		let createdId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "To Be Updated",
					mediaPath: "blogs/media/original.webp",
					isPublic: true,
				}),
			});
			const body = await res.json() as { id: number };
			createdId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${createdId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${createdId}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(403);
		});

		it("PUT updates gallery item successfully (200)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${createdId}`, {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "PUT Updated Title",
					mediaPath: "blogs/media/put-updated.webp",
					caption: "Brand new caption",
					aspectRatio: "4/3",
					isFeatured: true,
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.title).toBe("PUT Updated Title");
			expect(body.mediaPath).toBe("blogs/media/put-updated.webp");
			expect(body.caption).toBe("Brand new caption");
			expect(body.aspectRatio).toBe("4/3");
			expect(body.isFeatured).toBe(true);
		});

		it("PATCH updates specific fields and preserves others", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${createdId}`, {
				method: "PATCH",
				headers: adminHeaders,
				body: JSON.stringify({
					sortOrder: 88,
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.sortOrder).toBe(88);
			expect(body.title).toBe("PUT Updated Title");
		});
	});

	// ==================== TOGGLE ACTIONS ====================
	describe("PATCH /v1/api/gallery/:id/toggle-public & toggle-featured", () => {
		let toggleId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Toggle Test Item",
					mediaPath: "blogs/media/toggle.webp",
					isPublic: true,
					isFeatured: false,
				}),
			});
			const body = await res.json() as { id: number };
			toggleId = body.id;
		});

		it("toggles public status", async () => {
			// Initially isPublic = true -> toggles to false
			const res1 = await SELF.fetch(`http://example.com/v1/api/gallery/${toggleId}/toggle-public`, {
				method: "PATCH",
				headers: adminHeaders,
			});
			expect(res1.status).toBe(200);
			const body1 = await res1.json() as Record<string, unknown>;
			expect(body1.isPublic).toBe(false);

			// Toggles back to true
			const res2 = await SELF.fetch(`http://example.com/v1/api/gallery/${toggleId}/toggle-public`, {
				method: "PATCH",
				headers: adminHeaders,
			});
			expect(res2.status).toBe(200);
			const body2 = await res2.json() as Record<string, unknown>;
			expect(body2.isPublic).toBe(true);
		});

		it("toggles featured status", async () => {
			// Initially isFeatured = false -> toggles to true
			const res1 = await SELF.fetch(`http://example.com/v1/api/gallery/${toggleId}/toggle-featured`, {
				method: "PATCH",
				headers: adminHeaders,
			});
			expect(res1.status).toBe(200);
			const body1 = await res1.json() as Record<string, unknown>;
			expect(body1.isFeatured).toBe(true);

			// Toggles back to false
			const res2 = await SELF.fetch(`http://example.com/v1/api/gallery/${toggleId}/toggle-featured`, {
				method: "PATCH",
				headers: adminHeaders,
			});
			expect(res2.status).toBe(200);
			const body2 = await res2.json() as Record<string, unknown>;
			expect(body2.isFeatured).toBe(false);
		});
	});

	// ==================== ORDER SEQUENCE ====================
	describe("GET & PUT /v1/api/gallery/order-sequence", () => {
		it("GET returns sequence array", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/order-sequence", {
				headers: authHeaders,
			});
			expect(res.status).toBe(200);

			const body = await res.json() as { sequence: Array<{ id: number; sortOrder: number }> };
			expect(Array.isArray(body.sequence)).toBe(true);
			expect(body.sequence.length).toBeGreaterThan(0);
		});

		it("PUT reorders items with IDs array", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/order-sequence", {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({ ids: [2, 1] }),
			});
			expect(res.status).toBe(200);

			const check2 = await SELF.fetch("http://example.com/v1/api/gallery/2");
			const body2 = await check2.json() as { sortOrder: number };
			expect(body2.sortOrder).toBe(0);

			const check1 = await SELF.fetch("http://example.com/v1/api/gallery/1");
			const body1 = await check1.json() as { sortOrder: number };
			expect(body1.sortOrder).toBe(1);
		});
	});

	// ==================== DELETE ====================
	describe("DELETE /v1/api/gallery/:id", () => {
		let deleteId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Item To Delete",
					mediaPath: "blogs/media/delete.webp",
				}),
			});
			const body = await res.json() as { id: number };
			deleteId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${deleteId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for regular user", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${deleteId}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(403);
		});

		it("returns 404 for non-existent item", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/gallery/999999", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(404);
		});

		it("admin deletes gallery item (204)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/gallery/${deleteId}`, {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(204);

			// Subsequent query returns 404
			const check = await SELF.fetch(`http://example.com/v1/api/gallery/${deleteId}`);
			expect(check.status).toBe(404);
		});
	});
});
