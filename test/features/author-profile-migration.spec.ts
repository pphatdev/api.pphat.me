import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";

// The real migration file, loaded the same way seedDatabase loads migrations.
const files = (import.meta as any).glob("../../migrations/0035_author_profile_headline.sql", { query: "?raw", eager: true });
const MIGRATION_SQL: string = Object.values(files).map((m: any) => m.default ?? m)[0];

async function runMigration(): Promise<void> {
	const statements = MIGRATION_SQL.replace(/--.*$/gm, "")
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean);
	for (const sql of statements) await env.DB.prepare(sql).run();
}

const NOW = "2026-01-01T00:00:00.000Z";
const author = (name: string, profile: string) =>
	env.DB.prepare("INSERT INTO authors (name, profile, url) VALUES (?1, ?2, '')").bind(name, profile).run();
const details = (authorId: number, avatar: string) =>
	env.DB.prepare(
		"INSERT INTO author_details (author_id, bio, avatar_url, social_links, status, created_at, updated_at) VALUES (?1, '', ?2, '[]', 1, ?3, ?3)",
	)
		.bind(authorId, avatar, NOW)
		.run();
const read = (id: number) =>
	env.DB.prepare("SELECT a.profile, d.avatar_url FROM authors a LEFT JOIN author_details d ON d.author_id = a.id WHERE a.id = ?1")
		.bind(id)
		.first<{ profile: string; avatar_url: string | null }>();

describe("0035_author_profile_headline migration", () => {
	let urlNoAvatar: number, urlNoDetails: number, urlWithAvatar: number, headline: number;

	beforeAll(async () => {
		await seedDatabase(env.DB);
		urlNoAvatar = (await author("Url NoAvatar", "https://github.com/pphatdev.png")).meta.last_row_id;
		await details(urlNoAvatar, "");
		urlNoDetails = (await author("Url NoDetails", "https://github.com/navid.png")).meta.last_row_id;
		urlWithAvatar = (await author("Url WithAvatar", "http://example.com/old.png")).meta.last_row_id;
		await details(urlWithAvatar, "https://cdn.example.com/current.png");
		headline = (await author("Headline", "Back-End Developer")).meta.last_row_id;
		await details(headline, "https://cdn.example.com/kean.png");
		await runMigration();
	});

	it("moves a URL profile into an empty avatar and clears profile", async () => {
		expect(await read(urlNoAvatar)).toEqual({ profile: "", avatar_url: "https://github.com/pphatdev.png" });
	});

	it("creates the details row when missing", async () => {
		expect(await read(urlNoDetails)).toEqual({ profile: "", avatar_url: "https://github.com/navid.png" });
	});

	it("never overwrites an existing avatar", async () => {
		expect(await read(urlWithAvatar)).toEqual({ profile: "", avatar_url: "https://cdn.example.com/current.png" });
	});

	it("leaves headline profiles untouched", async () => {
		expect(await read(headline)).toEqual({ profile: "Back-End Developer", avatar_url: "https://cdn.example.com/kean.png" });
	});

	it("is idempotent", async () => {
		const before = await Promise.all([urlNoAvatar, urlNoDetails, urlWithAvatar, headline].map(read));
		await runMigration();
		const after = await Promise.all([urlNoAvatar, urlNoDetails, urlWithAvatar, headline].map(read));
		expect(after).toEqual(before);
		const urls = await env.DB.prepare("SELECT COUNT(*) AS n FROM authors WHERE profile LIKE 'http%'").first<{ n: number }>();
		expect(urls?.n).toBe(0);
	});
});
