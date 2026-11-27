import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

const SELF = exports.default;

const preflight = (origin: string, headers: string) =>
	SELF.fetch("http://example.com/v1/api/articles/some-slug/comments", {
		method: "OPTIONS",
		headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": headers },
	});

describe("CORS", () => {
	it("allows Authorization explicitly for allowed origins (a `*` would not)", async () => {
		const res = await preflight("https://pphat.me", "authorization,content-type");
		expect(res.headers.get("access-control-allow-origin")).toBe("https://pphat.me");
		const allowed = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase().split(/\s*,\s*/);
		expect(allowed).toEqual(expect.arrayContaining(["authorization", "content-type", "x-api-key"]));
		expect(allowed).not.toContain("*");
	});

	it("does not grant unknown origins", async () => {
		const res = await preflight("https://evil.example", "authorization");
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
	});
});
