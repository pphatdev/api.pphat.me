import { env, exports } from "cloudflare:workers";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("AI API", () => {
	it("POST /v1/api/ai/generate without token returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/ai/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Test title" }),
		});

		expect(res.status).toBe(401);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("error");
	});

	it("POST /v1/api/ai/generate with missing title returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/ai/generate", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ mode: "both" }),
		});

		expect(res.status).toBe(422);
		const body = await res.json() as Record<string, unknown>;
		expect(body.error).toBe("title is required");
	});

	it("POST /v1/api/ai/generate returns generated description and content", async () => {
		const aiRun = vi.fn().mockResolvedValue({
			response: JSON.stringify({
				description: "Short generated description.",
				content: "## Generated\n\nGenerated content body.",
			}),
		} as any);
		const previousAI = (env as any).AI;
		(env as any).AI = { run: aiRun };

		try {
			const res = await SELF.fetch("http://example.com/v1/api/ai/generate", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Building API with Workers",
					context: "Blog and project API",
					mode: "both",
				}),
			});

			expect(res.status).toBe(200);
			expect(aiRun).toHaveBeenCalledTimes(1);

			const body = await res.json() as {
				model: string;
				mode: string;
				data: { description?: string; content?: string };
			};
			expect(body.mode).toBe("both");
			expect(body.data.description).toBe("Short generated description.");
			expect(body.data.content).toContain("Generated content body");
		} finally {
			if (previousAI === undefined) {
				delete (env as any).AI;
			} else {
				(env as any).AI = previousAI;
			}
		}
	});
});
