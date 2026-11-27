import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { AuthController } from "../../apps/modules/auth/auth.controller";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";
import { authRedirectAllowlist, authRedirectTarget, canonicalOAuthStart } from "../../apps/modules/auth/oauth-canonical";

const SELF = exports.default;
const PROD = { APP_URL: "https://api.pphat.me" } as Pick<Env, "APP_URL">;

describe("canonicalOAuthStart", () => {
	it("bounces a start request on another host to APP_URL, keeping path and query, without setting a cookie", () => {
		// The production failure: admin started login on api.pphat.top, GitHub returned to api.pphat.me.
		const res = canonicalOAuthStart(new Request("https://api.pphat.top/v1/api/auth/github?redirect=%2Fdashboard"), PROD);
		expect(res?.status).toBe(302);
		expect(res?.headers.get("Location")).toBe("https://api.pphat.me/v1/api/auth/github?redirect=%2Fdashboard");
		expect(res?.headers.get("Set-Cookie")).toBeNull();
	});

	it("does nothing when already on the APP_URL host", () => {
		expect(canonicalOAuthStart(new Request("https://api.pphat.me/v1/api/auth/google"), PROD)).toBeNull();
	});

	it("does nothing when APP_URL is local (dev/tests) or invalid", () => {
		const req = new Request("http://example.com/v1/api/auth/github");
		expect(canonicalOAuthStart(req, { APP_URL: "http://localhost:8787" })).toBeNull();
		expect(canonicalOAuthStart(req, { APP_URL: "http://127.0.0.1:8787" })).toBeNull();
		expect(canonicalOAuthStart(req, { APP_URL: "not a url" })).toBeNull();
	});

	it("treats a different port as a different host", () => {
		const res = canonicalOAuthStart(new Request("https://api.pphat.me:8443/v1/api/auth/github"), PROD);
		expect(res?.headers.get("Location")).toBe("https://api.pphat.me/v1/api/auth/github");
	});
});

describe("OAuth start endpoints (test env, APP_URL=localhost)", () => {
	it.each(["github", "google"])("%s still redirects to the provider and sets oauth_state", async (provider) => {
		const res = await SELF.fetch(`http://example.com/v1/api/auth/${provider}`, { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toMatch(provider === "github" ? /github\.com\/login\/oauth\/authorize/ : /accounts\.google\.com/);
		expect(res.headers.get("set-cookie")).toMatch(/oauth_state=/);
	});
});

describe("OAuth callback with AUTH_REDIRECT_URL (browser lands back in the admin)", () => {
	const ADMIN = "https://admin.example.test/auth/callback";
	const appEnv = () => ({ ...env, AUTH_REDIRECT_URL: ADMIN }) as Env;
	const fragment = (res: Response) => new URLSearchParams(new URL(res.headers.get("location")!).hash.slice(1));

	beforeAll(async () => {
		await seedDatabase(env.DB);
	});
	afterEach(() => vi.restoreAllMocks());

	/** Start a GitHub flow and return the callback request a browser would make. */
	async function browserCallback(code = "CODE"): Promise<Request> {
		const start = await AuthController.github(new Request("http://example.com/v1/api/auth/github"), appEnv());
		const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
		const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0]!;
		return new Request(`http://example.com/v1/api/auth/github/callback?code=${code}&state=${encodeURIComponent(state)}`, {
			headers: { Cookie: cookie },
		});
	}

	it("redirects to the app with tokens in the URL fragment and sets the refresh cookie", async () => {
		const realFetch = globalThis.fetch;
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_test" });
			if (url === "https://api.github.com/user") {
				return Response.json({ id: 424242, login: "octo-redirect", name: "Octo", email: null, avatar_url: "https://avatars.githubusercontent.com/u/424242" });
			}
			if (url === "https://api.github.com/user/emails") return Response.json([{ email: "octo-redirect@example.com", primary: true, verified: true }]);
			return realFetch(input as RequestInfo, init);
		});

		const res = await AuthController.githubCallback(await browserCallback(), appEnv());
		expect(res.status).toBe(302);
		const location = res.headers.get("location")!;
		expect(location.startsWith(`${ADMIN}#`)).toBe(true);
		expect(new URL(location).search).toBe(""); // tokens never in the query string
		const params = fragment(res);
		expect(params.get("accessToken")).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
		expect(params.get("refreshToken")).toBeTruthy();
		const cookies = res.headers.get("set-cookie") ?? "";
		expect(cookies).toMatch(/oauth_state=;/); // state cookie cleared
		expect(cookies).toMatch(/refresh/i);
	});

	it("redirects with #error=invalid_state when the state cookie is missing", async () => {
		const req = await browserCallback();
		const noCookie = new Request(req.url); // cookie lost, e.g. started on another host
		const res = await AuthController.githubCallback(noCookie, appEnv());
		expect(res.status).toBe(302);
		expect(fragment(res).get("error")).toBe("invalid_state");
		expect(fragment(res).get("accessToken")).toBeNull();
	});

	it("redirects with the provider's error when the user denies access", async () => {
		const res = await AuthController.githubCallback(
			new Request("http://example.com/v1/api/auth/github/callback?error=access_denied"),
			appEnv(),
		);
		expect(fragment(res).get("error")).toBe("access_denied");
	});

	it("authRedirectTarget accepts only http(s) URLs", () => {
		expect(authRedirectTarget({ AUTH_REDIRECT_URL: ADMIN })?.href).toBe(ADMIN);
		expect(authRedirectTarget({ AUTH_REDIRECT_URL: "javascript:alert(1)" })).toBeNull();
		expect(authRedirectTarget({ AUTH_REDIRECT_URL: "not a url" })).toBeNull();
		expect(authRedirectTarget({})).toBeNull();
	});
});

describe("OAuth return_to allowlist (blog readers return to the blog)", () => {
	const ADMIN = "https://admin.example.test/auth/callback";
	const BLOG = "https://blog.example.test/auth/callback";
	const appEnv = () => ({ ...env, AUTH_REDIRECT_URL: ADMIN, AUTH_REDIRECT_ALLOWLIST: ` ${BLOG} , not a url,${ADMIN}` }) as Env;
	const fragment = (res: Response) => new URLSearchParams(new URL(res.headers.get("location")!).hash.slice(1));

	// Database already seeded by the earlier describe block in this file.
	afterEach(() => vi.restoreAllMocks());

	async function startWith(returnTo?: string) {
		const q = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : "";
		const start = await AuthController.github(new Request(`http://example.com/v1/api/auth/github${q}`), appEnv());
		const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
		const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0]!;
		return { state, cookie };
	}

	function stubGitHub() {
		const realFetch = globalThis.fetch;
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_test" });
			if (url === "https://api.github.com/user") return Response.json({ id: 515151, login: "reader", name: "Reader", email: null, avatar_url: "" });
			if (url === "https://api.github.com/user/emails") return Response.json([{ email: "reader@example.com", primary: true, verified: true }]);
			return realFetch(input as RequestInfo, init);
		});
	}

	const callback = (state: string, cookie: string, extra = "code=CODE") =>
		AuthController.githubCallback(
			new Request(`http://example.com/v1/api/auth/github/callback?${extra}&state=${encodeURIComponent(state)}`, { headers: { Cookie: cookie } }),
			appEnv(),
		);

	it("returns to an allowlisted return_to with tokens", async () => {
		stubGitHub();
		const { state, cookie } = await startWith(BLOG);
		const res = await callback(state, cookie);
		expect(res.headers.get("location")!.startsWith(`${BLOG}#`)).toBe(true);
		expect(fragment(res).get("accessToken")).toBeTruthy();
	});

	it("ignores a return_to that is not allowlisted (no open redirect)", async () => {
		stubGitHub();
		const { state, cookie } = await startWith("https://evil.example/steal");
		const res = await callback(state, cookie);
		expect(res.headers.get("location")!.startsWith(`${ADMIN}#`)).toBe(true);
	});

	it("sends provider errors back to the app that started sign-in", async () => {
		const { state, cookie } = await startWith(BLOG);
		const res = await callback(state, cookie, "error=access_denied");
		expect(res.headers.get("location")!.startsWith(`${BLOG}#`)).toBe(true);
		expect(fragment(res).get("error")).toBe("access_denied");
	});

	it("authRedirectAllowlist keeps the default first, drops invalid and duplicate entries", () => {
		expect(authRedirectAllowlist({ AUTH_REDIRECT_URL: ADMIN, AUTH_REDIRECT_ALLOWLIST: ` ${BLOG} , not a url,${ADMIN}` }).map((u) => u.href)).toEqual([ADMIN, BLOG]);
		expect(authRedirectTarget({ AUTH_REDIRECT_URL: ADMIN, AUTH_REDIRECT_ALLOWLIST: BLOG }, BLOG)?.href).toBe(BLOG);
		expect(authRedirectTarget({ AUTH_REDIRECT_URL: ADMIN, AUTH_REDIRECT_ALLOWLIST: BLOG }, "https://evil.example/")?.href).toBe(ADMIN);
		expect(authRedirectTarget({ AUTH_REDIRECT_ALLOWLIST: BLOG }, null)).toBeNull();
	});
});

