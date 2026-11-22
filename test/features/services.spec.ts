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

describe("Services API", () => {
	// ==================== OVERVIEW & SECTION HEADER ====================
	describe("GET /v1/api/services/overview", () => {
		it("returns 200 with section header and active services (public)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/overview");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("section");
			expect(body).toHaveProperty("services");
			expect(body).toHaveProperty("total");

			const section = body.section as Record<string, unknown>;
			expect(section.badge).toBe("Feature");
			expect(section.title).toBe("What I can do for you");
			expect(section.description).toContain("I can help you build your next project");

			const services = body.services as Array<{ title: string; icon: string }>;
			expect(services.length).toBeGreaterThanOrEqual(2);
			expect(services.some((s) => s.title === "Web Development")).toBe(true);
			expect(services.some((s) => s.title === "Web Hosting")).toBe(true);
		});

		it("alias GET /v1/api/service/overview returns 200", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/service/overview");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("section");
		});
	});

	describe("GET /v1/api/services/section", () => {
		it("returns 200 with section header", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/section");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.badge).toBe("Feature");
			expect(body.title).toBe("What I can do for you");
		});
	});

	describe("PUT /v1/api/services/section", () => {
		it("returns 401 without auth", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/section", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Updated Header" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/section", {
				method: "PUT",
				headers: authHeaders,
				body: JSON.stringify({ title: "Updated Header" }),
			});
			expect(res.status).toBe(403);
		});

		it("admin updates section header successfully (200)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/section", {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({
					badge: "Core Offerings",
					title: "What I bring to your team",
					description: "End-to-end engineering excellence from concept to production.",
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.badge).toBe("Core Offerings");
			expect(body.title).toBe("What I bring to your team");
			expect(body.description).toBe("End-to-end engineering excellence from concept to production.");
		});
	});

	// ==================== LIST / READ ====================
	describe("GET /v1/api/services (List)", () => {
		it("public request returns 200 with only active services", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ status: number }>; pagination: unknown };
			expect(Array.isArray(body.data)).toBe(true);
			for (const item of body.data) {
				expect(item.status).toBe(1);
			}
		});

		it("alias GET /v1/api/services/public returns 200", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/public");
			expect(res.status).toBe(200);
			const body = await res.json() as { data: unknown[] };
			expect(Array.isArray(body.data)).toBe(true);
		});

		it("alias GET /v1/api/service returns 200 with list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/service");
			expect(res.status).toBe(200);
			const body = await res.json() as { data: unknown[] };
			expect(Array.isArray(body.data)).toBe(true);
		});

		it("filters by category", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services?category=Development");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ category: string }> };
			expect(body.data.length).toBeGreaterThan(0);
			for (const item of body.data) {
				expect(item.category).toBe("Development");
			}
		});

		it("searches by title or description", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services?search=Hosting");
			expect(res.status).toBe(200);

			const body = await res.json() as { data: Array<{ title: string }> };
			expect(body.data.length).toBeGreaterThan(0);
			expect(body.data[0].title).toBe("Web Hosting");
		});
	});

	// ==================== GET BY ID ====================
	describe("GET /v1/api/services/:id", () => {
		it("returns 200 with service details", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/1");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(1);
			expect(body.title).toBe("Web Development");
			expect(body.icon).toBe("terminal");
			expect(Array.isArray(body.features)).toBe(true);
		});

		it("alias GET /v1/api/service/:id returns 200", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/service/1");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(1);
		});

		it("returns 400 for invalid ID format", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/not-a-number");
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent service ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/999999");
			expect(res.status).toBe(404);
		});
	});

	// ==================== CREATE ====================
	describe("POST /v1/api/services", () => {
		it("returns 401 without auth", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "UI/UX Design", description: "Interface design" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ title: "UI/UX Design", description: "Interface design" }),
			});
			expect(res.status).toBe(403);
		});

		it("returns 422 when required fields are missing", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({ icon: "palette" }),
			});
			expect(res.status).toBe(422);
		});

		it("admin creates service successfully (201) and supports aliases", async () => {
			const payload = {
				title: "UI/UX Design",
				summary: "Intuitive, accessible, and responsive user experiences.",
				iconName: "palette",
				category: "Design",
				features: ["Figma Wireframing", "Interactive Prototypes", "Design Systems"],
				linkUrl: "https://pphat.me/contact",
				sortOrder: 3,
				isActive: true,
			};

			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(201);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("id");
			expect(body.title).toBe("UI/UX Design");
			expect(body.description).toBe("Intuitive, accessible, and responsive user experiences.");
			expect(body.icon).toBe("palette");
			expect(body.category).toBe("Design");
			expect(body.features).toEqual(["Figma Wireframing", "Interactive Prototypes", "Design Systems"]);
			expect(body.linkUrl).toBe("https://pphat.me/contact");
			expect(body.sortOrder).toBe(3);
			expect(body.status).toBe(1);
		});
	});

	// ==================== UPDATE ====================
	describe("PUT / PATCH /v1/api/services/:id", () => {
		let createdId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Service To Update",
					description: "Original Description",
					icon: "code",
					status: 1,
				}),
			});
			const body = await res.json() as { id: number };
			createdId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${createdId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${createdId}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(403);
		});

		it("returns 404 for non-existent service", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/999999", {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(404);
		});

		it("PUT updates service successfully (200)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${createdId}`, {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Full Stack Engineering",
					description: "Complete end-to-end architecture and implementation.",
					icon: "cpu",
					category: "Engineering",
					status: 1,
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.title).toBe("Full Stack Engineering");
			expect(body.description).toBe("Complete end-to-end architecture and implementation.");
			expect(body.icon).toBe("cpu");
			expect(body.category).toBe("Engineering");
		});

		it("PATCH updates specific fields and preserves others", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${createdId}`, {
				method: "PATCH",
				headers: adminHeaders,
				body: JSON.stringify({
					sortOrder: 99,
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.sortOrder).toBe(99);
			expect(body.title).toBe("Full Stack Engineering"); // Preserved
		});
	});

	// ==================== ORDER SEQUENCE ====================
	describe("GET & PUT /v1/api/services/order-sequence", () => {
		it("GET returns sequence array", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/order-sequence", {
				headers: authHeaders,
			});
			expect(res.status).toBe(200);

			const body = await res.json() as { sequence: Array<{ id: number; sortOrder: number }> };
			expect(Array.isArray(body.sequence)).toBe(true);
			expect(body.sequence.length).toBeGreaterThan(0);
		});

		it("PUT reorders services with IDs array", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/order-sequence", {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({ ids: [2, 1] }),
			});
			expect(res.status).toBe(200);

			const check2 = await SELF.fetch("http://example.com/v1/api/services/2");
			const body2 = await check2.json() as { sortOrder: number };
			expect(body2.sortOrder).toBe(0);

			const check1 = await SELF.fetch("http://example.com/v1/api/services/1");
			const body1 = await check1.json() as { sortOrder: number };
			expect(body1.sortOrder).toBe(1);
		});
	});

	// ==================== DELETE ====================
	describe("DELETE /v1/api/services/:id", () => {
		let deleteId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Service To Delete",
					description: "Will be deleted",
				}),
			});
			const body = await res.json() as { id: number };
			deleteId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${deleteId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${deleteId}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(403);
		});

		it("returns 404 for non-existent service ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/services/999999", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(404);
		});

		it("admin deletes service successfully (204)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/services/${deleteId}`, {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(204);

			// Subsequent fetch returns 404
			const check = await SELF.fetch(`http://example.com/v1/api/services/${deleteId}`);
			expect(check.status).toBe(404);
		});
	});
});
