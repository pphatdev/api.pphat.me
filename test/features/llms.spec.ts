import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, PROJECT_SLUG } from "../../apps/shared/helpers/test-cases";
import { inline, stripLeadingTitle } from "../../apps/modules/llms/llms.builder";

const SELF = exports.default;
const BASE = "http://example.com";

const DRAFT_ARTICLE_SLUG = "llms-draft-article";
const DRAFT_PROJECT_SLUG = "llms-draft-project";
const PRIVATE_MARKER = "llms-private-contact-message-marker";

beforeAll(async () => {
	await seedDatabase(env.DB);
	const now = "2026-01-01T00:00:00.000Z";

	// Unpublished article and project: must never be exposed through llms.txt.
	await env.DB.prepare(
		`INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, is_public, content, file_path, owner_id, created_at, updated_at)
		 VALUES (?1, 'Draft Article', ?2, 'secret draft', '', 0, 0, '# Draft body', '', NULL, ?3, ?3)`,
	).bind("00000000-0000-4000-8000-0000000011a1", DRAFT_ARTICLE_SLUG, now).run();
	await env.DB.prepare(
		`INSERT OR IGNORE INTO projects (id, title, slug, description, thumbnail, published, created_at, updated_at, languages)
		 VALUES (?1, 'Draft Project', ?2, 'secret draft project', '', 0, ?3, ?3, '[]')`,
	).bind("00000000-0000-4000-8000-0000000011b1", DRAFT_PROJECT_SLUG, now).run();

	// About + contact FAQs (active) and one inactive FAQ that must stay hidden.
	await env.DB.prepare(
		`INSERT OR IGNORE INTO faqs (id, question, slug, answer, category, sort_order, status, article_id, created_at, updated_at)
		 VALUES (901, 'Where is PPhat based?', 'llms-where-based', 'Phnom Penh, Cambodia.', 'About', 1, 1, NULL, ?1, ?1),
		        (902, 'How can I contact PPhat?', 'llms-how-to-contact', 'Use the contact page or GitHub.', 'About', 2, 1, NULL, ?1, ?1),
		        (903, 'Hidden about question', 'llms-hidden', 'hidden answer', 'About', 3, 0, NULL, ?1, ?1)`,
	).bind(now).run();

	// A submitted contact message: private data that must never appear in any llms.txt.
	await env.DB.prepare(
		`INSERT OR IGNORE INTO contact_messages (id, name, email, subject, message)
		 VALUES ('00000000-0000-4000-8000-0000000011c1', 'Visitor', 'visitor@example.com', 'Hi', ?1)`,
	).bind(PRIVATE_MARKER).run();
});

async function getText(path: string) {
	const res = await SELF.fetch(`${BASE}${path}`);
	return { res, body: await res.text() };
}

describe("llms.txt generator", () => {
	// ==================== SITE INDEX ====================
	it("GET /llms.txt returns a plain-text index linking every public page", async () => {
		const { res, body } = await getText("/llms.txt");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		expect(res.headers.get("cache-control")).toContain("max-age");
		expect(body.startsWith("# ")).toBe(true);
		expect(body).toContain("> Portfolio and blog of Leat Sophat");
		expect(body).toContain(`${BASE}/about/llms.txt`);
		expect(body).toContain(`${BASE}/contact/llms.txt`);
		expect(body).toContain(`[Test Article](${BASE}/articles/${ARTICLE_SLUG}/llms.txt): A test article description.`);
		expect(body).toContain(`[Test Project](${BASE}/projects/${PROJECT_SLUG}/llms.txt)`);
	});

	it("GET /llms.txt does not list drafts", async () => {
		const { body } = await getText("/llms.txt");
		expect(body).not.toContain(DRAFT_ARTICLE_SLUG);
		expect(body).not.toContain(DRAFT_PROJECT_SLUG);
	});

	// ==================== ARTICLES ====================
	it("GET /articles/:slug/llms.txt renders a published article with metadata and content", async () => {
		const { res, body } = await getText(`/articles/${ARTICLE_SLUG}/llms.txt`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		expect(body.startsWith("# Test Article\n")).toBe(true);
		expect(body).toContain("> A test article description.");
		expect(body).toContain(`- URL: https://pphat.me/articles/${ARTICLE_SLUG}`);
		expect(body).toContain("- Tags: javascript");
		expect(body).toContain("## Article");
		expect(body).toContain("Hello World");
		expect(body).toContain(`${BASE}/about/llms.txt`);
	});

	it("GET /articles/:slug/llms.txt returns 404 for unknown slugs", async () => {
		const { res } = await getText("/articles/does-not-exist/llms.txt");
		expect(res.status).toBe(404);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("GET /articles/:slug/llms.txt returns 404 for unpublished articles", async () => {
		const { res, body } = await getText(`/articles/${DRAFT_ARTICLE_SLUG}/llms.txt`);
		expect(res.status).toBe(404);
		expect(body).not.toContain("Draft body");
	});

	it("GET /articles/:slug/llms.txt rejects oversized slugs without querying", async () => {
		const { res } = await getText(`/articles/${"a".repeat(201)}/llms.txt`);
		expect(res.status).toBe(404);
	});

	// ==================== PROJECTS ====================
	it("GET /projects/:slug/llms.txt renders a published project with details", async () => {
		const { res, body } = await getText(`/projects/${PROJECT_SLUG}/llms.txt`);
		expect(res.status).toBe(200);
		expect(body.startsWith("# Test Project\n")).toBe(true);
		expect(body).toContain("> A test project description.");
		expect(body).toContain(`- URL: https://pphat.me/projects/${PROJECT_SLUG}`);
		expect(body).toContain("- Status: in-progress");
		expect(body).toContain("- Tech stack: TypeScript");
		expect(body).toContain("- Live demo: https://demo.example.com");
		expect(body).toContain("- Source code: https://github.com/example/project");
		expect(body).toContain("Project content");
	});

	it("GET /projects/:slug/llms.txt returns 404 for unpublished projects", async () => {
		const { res } = await getText(`/projects/${DRAFT_PROJECT_SLUG}/llms.txt`);
		expect(res.status).toBe(404);
	});

	// ==================== ABOUT ====================
	it("GET /about/llms.txt renders the active profile and active About FAQs", async () => {
		const { res, body } = await getText("/about/llms.txt");
		expect(res.status).toBe(200);
		expect(body.startsWith("# About Leat Sophat\n")).toBe(true);
		expect(body).toContain("- Also known as: PPhat");
		expect(body).toContain("- Role: Senior Front-end Developer");
		expect(body).toContain("- Location: Phnom Penh, Cambodia");
		expect(body).toContain("## Biography");
		expect(body).toContain("### Where is PPhat based?");
		expect(body).not.toContain("Hidden about question");
	});

	// ==================== CONTACT ====================
	it("GET /contact/llms.txt explains how to get in touch with contact FAQs", async () => {
		const { res, body } = await getText("/contact/llms.txt");
		expect(res.status).toBe(200);
		expect(body.startsWith("# Contact Leat Sophat\n")).toBe(true);
		expect(body).toContain("https://pphat.me/contact");
		expect(body).toContain("## Contact form");
		expect(body).toContain("### How can I contact PPhat?");
		expect(body).not.toContain("Where is PPhat based?");
	});

	it("never exposes submitted contact messages on any llms.txt", async () => {
		for (const path of ["/llms.txt", "/contact/llms.txt", "/about/llms.txt"]) {
			const { body } = await getText(path);
			expect(body).not.toContain(PRIVATE_MARKER);
			expect(body).not.toContain("visitor@example.com");
		}
	});
});

describe("llms.txt builder helpers", () => {
	it("inline() collapses newlines so values stay on one Markdown line", () => {
		expect(inline("  a\nb\t c  ")).toBe("a b c");
		expect(inline(null)).toBe("");
	});

	it("stripLeadingTitle() removes only a duplicated leading H1", () => {
		expect(stripLeadingTitle("# My Post\n\nBody", "My Post")).toBe("Body");
		expect(stripLeadingTitle("# Other\n\nBody", "My Post")).toBe("# Other\n\nBody");
		expect(stripLeadingTitle("Body only", "My Post")).toBe("Body only");
	});
});
