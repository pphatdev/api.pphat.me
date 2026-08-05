import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, PROJECT_SLUG } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;

beforeAll(async () => {
	await seedDatabase(env.DB);
});

describe("Project Details API", () => {
	/**
	 * GET /v1/api/projects/:slug/details is the only mounted endpoint —
	 * see apps/modules/projects/projects.route.ts.
	 */
	describe("GET /v1/api/projects/:slug/details", () => {
		it("returns project details for seeded project", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/projects/${PROJECT_SLUG}/details`,
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("projectId");
			expect(body).toHaveProperty("content");
		});

		it("returns 404 for non-existent project slug", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/projects/non-existent/details",
			);
			expect(res.status).toBe(404);
		});

		it("returns 404 when project exists but has no details", async () => {
			const slug = `no-details-${Date.now()}`;
			// Insert a project with no matching project_details row.
			await env.DB.prepare(
				`INSERT INTO projects (id, title, slug, description, thumbnail, published, created_at, updated_at, languages)
				 VALUES (?1, ?2, ?3, ?4, '', 1, datetime('now'), datetime('now'), '[]')`,
			)
				.bind(
					"00000000-0000-4000-8000-0000000000d1",
					"No Details",
					slug,
					"Missing details row.",
				)
				.run();

			const res = await SELF.fetch(
				`http://example.com/v1/api/projects/${slug}/details`,
			);
			expect(res.status).toBe(404);
		});
	});
});
