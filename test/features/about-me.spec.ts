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

describe("About Me API", () => {
	// ==================== GET ACTIVE PROFILE ====================
	describe("GET /v1/api/about-me/active", () => {
		it("returns 200 with active profile (public)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/active");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("id");
			expect(body.badge).toBe("About me!");
			expect(body.title).toBe("Who the hell am I ?");
			expect(typeof body.description).toBe("string");
			expect(body.content).toBe(body.description);
			expect(body.bio).toBe(body.description);
			expect(body.buttonText).toBe("Gallery");
			expect(body.button_text).toBe("Gallery");
			expect(body.buttonUrl).toBe("https://pphat.me/gallery");
			expect(body.name).toBe("Leat Sophat");
			expect(body.nickname).toBe("PPhat");
			expect(body.role).toBe("Senior Front-end Developer");
			expect(body.location).toBe("Phnom Penh, Cambodia");
			expect(Array.isArray(body.images)).toBe(true);
			expect((body.images as string[]).length).toBe(3);
			expect(body.status).toBe(1);
		});

		it("alias GET /v1/api/about/active returns 200 with same active profile", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about/active");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.title).toBe("Who the hell am I ?");
		});
	});

	// ==================== LIST / READ ====================
	describe("GET /v1/api/about-me (List)", () => {
		it("public request returns 200 with active profiles", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me");
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");

			const items = body.data as Array<{ status: number }>;
			for (const item of items) {
				expect(item.status).toBe(1);
			}
		});

		it("alias GET /v1/api/about returns 200 with paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});

		it("admin request with status=all returns all profiles", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me?status=all", {
				headers: adminHeaders,
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(Array.isArray(body.data)).toBe(true);
		});

		it("supports search query matching title or description", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me?search=TURBOTECH");
			expect(res.status).toBe(200);
			const body = await res.json() as { data: Array<{ description: string }> };
			expect(body.data.length).toBeGreaterThan(0);
			expect(body.data[0].description).toContain("TURBOTECH");
		});
	});

	// ==================== GET BY ID ====================
	describe("GET /v1/api/about-me/:id", () => {
		it("returns 200 with profile for existing ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/1");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(1);
			expect(body.title).toBe("Who the hell am I ?");
		});

		it("alias GET /v1/api/about/:id returns 200", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about/1");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.id).toBe(1);
		});

		it("returns 400 for invalid ID format", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/invalid-id");
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body.error).toContain("Invalid ID");
		});

		it("returns 404 for non-existent profile ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/999999");
			expect(res.status).toBe(404);
		});
	});

	// ==================== CREATE ====================
	describe("POST /v1/api/about-me", () => {
		it("returns 401 without auth token", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "Unauthorized Title",
					description: "Unauthorized Bio",
				}),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Forbidden Title",
					description: "Forbidden Bio",
				}),
			});
			expect(res.status).toBe(403);
		});

		it("returns 422 when required fields are missing", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					badge: "Just badge",
				}),
			});
			expect(res.status).toBe(422);
		});

		it("returns 422 when images is not an array of strings", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Valid Title",
					description: "Valid Description",
					images: "not-an-array",
				}),
			});
			expect(res.status).toBe(422);
		});

		it("creates a new profile with admin token (201) and supports aliases", async () => {
			const payload = {
				badge: "New Badge",
				title: "Second Profile",
				bio: "Bio written with bio alias",
				buttonText: "Portfolio",
				buttonUrl: "https://example.com/portfolio",
				images: ["https://example.com/pic1.jpg"],
				name: "Jane Doe",
				nickname: "JD",
				role: "Staff Engineer",
				location: "Tokyo, Japan",
				sortOrder: 10,
				status: 1,
			};

			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(201);

			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("id");
			expect(body.badge).toBe("New Badge");
			expect(body.title).toBe("Second Profile");
			expect(body.description).toBe("Bio written with bio alias");
			expect(body.content).toBe("Bio written with bio alias");
			expect(body.buttonText).toBe("Portfolio");
			expect(body.buttonUrl).toBe("https://example.com/portfolio");
			expect(body.name).toBe("Jane Doe");
			expect(body.role).toBe("Staff Engineer");
			expect(body.location).toBe("Tokyo, Japan");
			expect(body.sortOrder).toBe(10);
			expect(body.images).toEqual(["https://example.com/pic1.jpg"]);
		});

		it("alias POST /v1/api/about creates successfully", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Third Profile via /about",
					description: "Third Description",
				}),
			});
			expect(res.status).toBe(201);
		});
	});

	// ==================== UPDATE (PUT / PATCH) ====================
	describe("PUT / PATCH /v1/api/about-me/:id", () => {
		let createdId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Profile To Update",
					description: "Original Description",
					button_text: "Original Button",
					status: 1,
				}),
			});
			const body = await res.json() as { id: number };
			createdId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${createdId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${createdId}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(403);
		});

		it("returns 404 for non-existent profile", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/999999", {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({ title: "Updated" }),
			});
			expect(res.status).toBe(404);
		});

		it("PUT updates profile successfully (200)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${createdId}`, {
				method: "PUT",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "PUT Updated Title",
					description: "PUT Updated Description",
					button_text: "Updated Action",
					button_url: "https://example.com/updated",
					role: "Lead Architect",
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.title).toBe("PUT Updated Title");
			expect(body.description).toBe("PUT Updated Description");
			expect(body.button_text).toBe("Updated Action");
			expect(body.button_url).toBe("https://example.com/updated");
			expect(body.role).toBe("Lead Architect");
		});

		it("PATCH partially updates profile with camelCase aliases (200)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${createdId}`, {
				method: "PATCH",
				headers: adminHeaders,
				body: JSON.stringify({
					buttonText: "Patched Button",
					sortOrder: 99,
				}),
			});
			expect(res.status).toBe(200);

			const body = await res.json() as Record<string, unknown>;
			expect(body.buttonText).toBe("Patched Button");
			expect(body.sortOrder).toBe(99);
			expect(body.title).toBe("PUT Updated Title"); // Preserved
		});

		it("alias PATCH /v1/api/about/:id updates successfully", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about/${createdId}`, {
				method: "PATCH",
				headers: adminHeaders,
				body: JSON.stringify({
					badge: "Patched via /about alias",
				}),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.badge).toBe("Patched via /about alias");
		});
	});

	// ==================== DELETE ====================
	describe("DELETE /v1/api/about-me/:id", () => {
		let deleteId: number;

		beforeAll(async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({
					title: "Profile To Delete",
					description: "Will be deleted",
				}),
			});
			const body = await res.json() as { id: number };
			deleteId = body.id;
		});

		it("returns 401 without auth", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${deleteId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(401);
		});

		it("returns 403 for non-admin user", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${deleteId}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(403);
		});

		it("returns 400 for invalid ID format", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/not-an-id", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent ID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/about-me/999999", {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(404);
		});

		it("deletes profile with admin token (204)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/about-me/${deleteId}`, {
				method: "DELETE",
				headers: adminHeaders,
			});
			expect(res.status).toBe(204);

			// Subsequent fetch returns 404
			const check = await SELF.fetch(`http://example.com/v1/api/about-me/${deleteId}`);
			expect(check.status).toBe(404);
		});
	});
});
