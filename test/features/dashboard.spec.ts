import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, getAdminHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminToken: string;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAdminHeaders(env.JWT_SECRET);
	adminToken = authHeaders.Authorization.split(" ")[1];
});

describe("Dashboard API", () => {

	/**
	 * GET /v1/api/dashboard
	 */
	describe("GET /v1/api/dashboard", () => {
		it("returns 401 without token", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/dashboard");
			expect(res.status).toBe(401);
		});

		it("returns dashboard data with valid token", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/dashboard", {
				headers: authHeaders
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, any>;
			expect(body).toEqual({
				blogs: { total: expect.any(Number), published: expect.any(Number), draft: expect.any(Number) },
				projects: { total: expect.any(Number), published: expect.any(Number), draft: expect.any(Number) },
				liveTraffic: expect.any(Number),
				topPosts: expect.any(Array),
				topProjects: expect.any(Array),
				newestPosts: expect.any(Array),
				newestProjects: expect.any(Array),
				newestContributors: expect.any(Array)
			});

			if (body.topPosts.length > 0) {
				expect(body.topPosts[0]).toMatchObject({
					id: expect.any(String),
					title: expect.any(String),
					slug: expect.any(String),
					description: expect.any(String),
					tags: expect.any(Array),
					authors: expect.any(Array),
					thumbnail: expect.any(String),
					published: expect.any(Boolean),
					ownerId: expect.any(String),
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
					filePath: expect.any(String)
				});
			}

			if (body.newestProjects.length > 0) {
				expect(body.newestProjects[0]).toMatchObject({
					id: expect.any(String),
					title: expect.any(String),
					slug: expect.any(String),
					description: expect.any(String),
					tags: expect.any(Array),
					contributors: expect.any(Array),
					languages: expect.any(Array),
					thumbnail: expect.any(String),
					published: expect.any(Boolean),
					createdAt: expect.any(String),
					updatedAt: expect.any(String)
				});
			}

			if (body.newestContributors.length > 0) {
				expect(body.newestContributors[0]).toMatchObject({
					id: expect.any(Number),
					name: expect.any(String),
					profile: expect.any(String),
					url: expect.any(String),
					bio: expect.any(String),
					avatarUrl: expect.any(String),
					socialLinks: expect.any(Array),
					status: expect.any(Number),
					createdAt: expect.any(String),
					updatedAt: expect.any(String)
				});
			}
		});
	});

	/**
	 * GET /v1/api/dashboard/live-traffic
	 */
	describe("GET /v1/api/dashboard/live-traffic", () => {
		it("returns 401 without token", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/dashboard/live-traffic");
			expect(res.status).toBe(401);
		});

		it("returns 200 and text/event-stream with valid header token", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/dashboard/live-traffic", {
				headers: authHeaders
			});
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toContain("text/event-stream");

			// Check first chunk
			const reader = res.body?.getReader();
			const { value } = await reader!.read();
			const decoded = new TextDecoder().decode(value);
			expect(decoded).toContain("data:");
			reader?.releaseLock();
		});

		it("returns 200 and text/event-stream with token in query param", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/dashboard/live-traffic?token=${adminToken}`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toContain("text/event-stream");

			const reader = res.body?.getReader();
			const { value } = await reader!.read();
			const decoded = new TextDecoder().decode(value);
			expect(decoded).toContain("data:");
			reader?.releaseLock();
		});
	});
});
