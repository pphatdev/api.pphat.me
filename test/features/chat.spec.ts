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

describe("Portfolio Chat API", () => {
	it("POST /v1/api/chat should work without auth (optional)", async () => {
		const aiRun = vi.fn().mockResolvedValue({
			response: "Hello! I am your portfolio chatbot. How can I help you?",
		} as any);
		const previousAI = (env as any).AI;
		(env as any).AI = { run: aiRun };

		try {
			const res = await SELF.fetch("http://example.com/v1/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "Hello" }),
			});

			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(body.response).toContain("portfolio chatbot");
			expect(body.history).toHaveLength(2);
		} finally {
			(env as any).AI = previousAI;
		}
	});

	it("POST /v1/api/chat should save history when authenticated", async () => {
		const aiRun = vi.fn().mockResolvedValue({
			response: "Sophat has skills in React and Node.js.",
		} as any);
		const previousAI = (env as any).AI;
		(env as any).AI = { run: aiRun };

		try {
			const res = await SELF.fetch("http://example.com/v1/api/chat", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ message: "What are your skills?" }),
			});

			expect(res.status).toBe(200);

			// Verify it saved to DB
			const historyRes = await SELF.fetch("http://example.com/v1/api/chat/history", {
				method: "GET",
				headers: authHeaders,
			});

			expect(historyRes.status).toBe(200);
			const historyBody = await historyRes.json() as any;
			expect(historyBody.history.length).toBeGreaterThanOrEqual(2);
		} finally {
			(env as any).AI = previousAI;
		}
	});

	it("GET /v1/api/chat/history without token returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/chat/history", {
			method: "GET",
		});
		expect(res.status).toBe(401);
	});
});
