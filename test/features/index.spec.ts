import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

const SELF = exports.default;

describe("Root", () => {
	it("GET / returns 404", async () => {
		const res = await SELF.fetch("http://example.com/");
		expect(res.status).toBe(404);
	});

	it("GET /v1/api returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api");
		expect(res.status).toBe(404);
	});
});
