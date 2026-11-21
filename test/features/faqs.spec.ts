import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, getAuthHeaders, getAdminHeaders, ARTICLE_ID } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("FAQs API", () => {
	// ==================== LIST / READ ====================
	it("GET /v1/api/faqs without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs");
		expect(res.status).toBe(401);
	});

	it("GET /v1/api/faqs with auth returns paginated list", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs?page=1&limit=10", {
			headers: authHeaders,
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(Array.isArray(body.data)).toBe(true);
		expect(body).toHaveProperty("pagination");

		const faqs = body.data as Array<Record<string, unknown>>;
		expect(faqs.length).toBeGreaterThan(0);
		const first = faqs[0];
		expect(first).toHaveProperty("id");
		expect(first).toHaveProperty("question");
		expect(first).toHaveProperty("answer");
		expect(first).toHaveProperty("content");
		expect(first.content).toBe(first.answer);
		expect(first).toHaveProperty("readingMins");
		expect(first).toHaveProperty("wordCount");
		expect(first).toHaveProperty("category");
	});

	it("GET /v1/api/faqs/public without auth returns 200 with only active FAQs", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/public");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(Array.isArray(body.data)).toBe(true);
		const list = body.data as Array<{ status: number }>;
		for (const item of list) {
			expect(item.status).toBe(1);
		}
	});

	it("GET /v1/api/faqs/:id returns FAQ by numeric ID (public)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/1");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body.id).toBe(1);
		expect(body.question).toBe("What is api.pphat.me?");
		expect(body.slug).toBe("what-is-api-pphat-me");
		expect(typeof body.answer).toBe("string");
		expect(body.content).toBe(body.answer);
		expect(body.readingMins).toBeGreaterThanOrEqual(1);
		expect(body.wordCount).toBeGreaterThan(0);
		expect(body).toHaveProperty("article");
		expect(body.article).not.toBeNull();
		const article = body.article as Record<string, unknown>;
		expect(article.id).toBe(ARTICLE_ID);
	});

	it("GET /v1/api/faqs/:slug returns FAQ by slug (public)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/what-is-api-pphat-me");
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body.id).toBe(1);
		expect(body.slug).toBe("what-is-api-pphat-me");
	});

	it("GET /v1/api/faqs/:id returns 404 for non-existent FAQ", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/99999");
		expect(res.status).toBe(404);
	});

	// ==================== CREATE ====================
	it("POST /v1/api/faqs without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			body: JSON.stringify({ question: "Unauthorized question?", answer: "No auth" }),
		});
		expect(res.status).toBe(401);
	});

	it("POST /v1/api/faqs as regular user returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ question: "User question?", answer: "User answer" }),
		});
		expect(res.status).toBe(403);
	});

	it("POST /v1/api/faqs with missing question returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ answer: "Answer without question" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST /v1/api/faqs with missing answer and article_id returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ question: "Question without answer?" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST /v1/api/faqs as admin creates an FAQ with rich article content (201)", async () => {
		const markdownContent = `
# How is authentication handled?

Authentication is built using industry standard **JWT** tokens:
- **Access tokens** expire after 15 minutes.
- **Refresh tokens** are stored as HttpOnly cookies.
- Passwords are encrypted using modern hashing algorithms.

\`\`\`typescript
const token = await createJwt(payload, secret);
\`\`\`
`.trim();

		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "How is authentication handled?",
				answer: markdownContent,
				category: "Security",
				sortOrder: 5,
				status: 1,
			}),
		});

		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body.id).toBeDefined();
		expect(body.question).toBe("How is authentication handled?");
		expect(body.answer).toBe(markdownContent);
		expect(body.content).toBe(markdownContent);
		expect(body.slug).toBe("how-is-authentication-handled");
		expect(body.category).toBe("Security");
		expect(body.sortOrder).toBe(5);
		expect(body.status).toBe(1);
		expect(body.readingMins).toBeGreaterThanOrEqual(1);
		expect(body.wordCount).toBeGreaterThan(15);
	});

	it("POST /v1/api/faqs supports 'content' alias for answer", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "Can I use content alias?",
				content: "# Yes\n\nThe content field is seamlessly aliased to answer.",
				category: "General",
			}),
		});

		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body.answer).toBe("# Yes\n\nThe content field is seamlessly aliased to answer.");
		expect(body.content).toBe(body.answer);
	});

	it("POST /v1/api/faqs with linked article_id inherits content if answer omitted", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "What is in the test article?",
				articleId: ARTICLE_ID,
				category: "Articles",
			}),
		});

		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body.articleId).toBe(ARTICLE_ID);
		expect(body.article).not.toBeNull();
		const article = body.article as Record<string, unknown>;
		expect(article.id).toBe(ARTICLE_ID);
		expect(body.answer).toBe("# Hello World");
	});

	it("POST /v1/api/faqs with duplicate slug returns 409 Conflict", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "Another FAQ",
				slug: "what-is-api-pphat-me", // Already exists from seed
				answer: "Duplicate slug test",
			}),
		});

		expect(res.status).toBe(409);
	});

	// ==================== UPDATE ====================
	it("PUT /v1/api/faqs/:id as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/1", {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({ question: "Updated question" }),
		});
		expect(res.status).toBe(403);
	});

	it("PUT /v1/api/faqs/:id as admin updates FAQ", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/1", {
			method: "PUT",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "What is api.pphat.me? (Updated)",
				answer: "Updated answer with **markdown** content.",
				category: "Overview",
				sortOrder: 10,
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body.id).toBe(1);
		expect(body.question).toBe("What is api.pphat.me? (Updated)");
		expect(body.answer).toBe("Updated answer with **markdown** content.");
		expect(body.content).toBe("Updated answer with **markdown** content.");
		expect(body.category).toBe("Overview");
		expect(body.sortOrder).toBe(10);
	});

	it("PATCH /v1/api/faqs/:id as admin updates partial FAQ", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/1", {
			method: "PATCH",
			headers: adminHeaders,
			body: JSON.stringify({
				category: "General",
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body.id).toBe(1);
		expect(body.category).toBe("General");
		// Other fields remain intact
		expect(body.question).toBe("What is api.pphat.me? (Updated)");
	});

	// ==================== INACTIVE / DRAFT ACCESS ====================
	it("Inactive FAQ (status 0) is hidden from public but visible to admin", async () => {
		// Create inactive FAQ
		const createRes = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "Draft FAQ hidden from public?",
				answer: "This is a draft answer.",
				status: 0,
			}),
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json() as { id: number };

		// Public get returns 404
		const publicGet = await SELF.fetch(`http://example.com/v1/api/faqs/${created.id}`);
		expect(publicGet.status).toBe(404);

		// Admin get returns 200
		const adminGet = await SELF.fetch(`http://example.com/v1/api/faqs/${created.id}`, {
			headers: adminHeaders,
		});
		expect(adminGet.status).toBe(200);
	});

	// ==================== DELETE ====================
	it("DELETE /v1/api/faqs/:id as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/1", {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /v1/api/faqs/:id as admin deletes FAQ (204)", async () => {
		// Create a temporary FAQ to delete
		const createRes = await SELF.fetch("http://example.com/v1/api/faqs", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				question: "To be deleted?",
				answer: "Disposable answer",
			}),
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json() as { id: number };

		const delRes = await SELF.fetch(`http://example.com/v1/api/faqs/${created.id}`, {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(delRes.status).toBe(204);

		// Subsequent get returns 404
		const checkRes = await SELF.fetch(`http://example.com/v1/api/faqs/${created.id}`);
		expect(checkRes.status).toBe(404);
	});

	it("DELETE /v1/api/faqs/:id with non-existent id returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/faqs/99999", {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(res.status).toBe(404);
	});
});
