import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

beforeAll(async () => {
	const stmts = [
		env.DB.prepare(`CREATE TABLE IF NOT EXISTS articles (
			id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
			published INTEGER NOT NULL DEFAULT 0, content TEXT NOT NULL DEFAULT '',
			file_path TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
		)`),
		env.DB.prepare(`CREATE TABLE IF NOT EXISTS article_authors (
			id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL,
			name TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT ''
		)`),
		env.DB.prepare(`CREATE TABLE IF NOT EXISTS article_tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL, tag TEXT NOT NULL
		)`),
		env.DB.prepare(`INSERT OR IGNORE INTO articles
			(id, title, slug, description, thumbnail, published, content, file_path, created_at, updated_at)
			VALUES ('stats-card-usage', 'Using Stats from stats.pphat.top', 'stats-card-usage',
				'Stats is an API endpoint.', 'blogs/stats-card-usage/cover.webp', 1,
				'# Overview', 'posts/stats-card-usage/index.mdx',
				'2026-03-19T08:00:00.000Z', '2026-03-19T08:00:00.000Z')`),
		env.DB.prepare(`INSERT OR IGNORE INTO article_authors (article_id, name, profile, url)
			VALUES ('stats-card-usage', 'pphatdev', '', '')`),
		env.DB.prepare(`INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES ('stats-card-usage', 'article')`),
		env.DB.prepare(`INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES ('stats-card-usage', 'github-readme')`),
	];
	await env.DB.batch(stmts);
});

describe("Articles API", () => {
	it("GET /v1/api/articles returns list (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/v1/api/articles");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json() as unknown[];
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThan(0);
	});

	it("GET /v1/api/articles/stats-card-usage returns article (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/v1/api/articles/stats-card-usage");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json() as Record<string, unknown>;
		expect(body["slug"]).toBe("stats-card-usage");
	});

	it("GET /v1/api/articles/unknown returns 404 (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/v1/api/articles/unknown-slug");
		expect(response.status).toBe(404);
	});

	it("GET / returns 404 (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(404);
	});
});

