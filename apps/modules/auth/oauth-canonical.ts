/**
 * OAuth must start on the same host the provider calls back to.
 *
 * The start endpoint sets the `oauth_state` cookie on the host it is served
 * from, and the callback URL is built from APP_URL (the host registered with
 * GitHub/Google). If a client starts the flow on another host that routes to
 * this Worker (e.g. the legacy api.pphat.top while APP_URL is api.pphat.me),
 * the browser keeps the cookie on that host, the callback never sees it, and
 * login fails with "Invalid or expired state".
 *
 * So: when the request host differs from APP_URL's host, bounce the start
 * request to APP_URL first (no cookie set). Skipped when APP_URL is localhost,
 * so local dev and tests behave as before.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * @description Redirect an OAuth start request to the APP_URL host when it arrived on another host.
 * @param { Request } request The incoming OAuth start request
 * @param { Pick<Env, 'APP_URL'> } env Worker env (APP_URL)
 * @returns { Response | null } A 302 to the canonical host, or null to continue normally
 */
export function canonicalOAuthStart(request: Request, env: Pick<Env, 'APP_URL'>): Response | null {
	let canonical: URL;
	try {
		canonical = new URL(env.APP_URL);
	} catch {
		return null;
	}
	if (LOCAL_HOSTS.has(canonical.hostname)) return null;

	const current = new URL(request.url);
	if (current.host === canonical.host) return null;

	const target = new URL(current.pathname + current.search, canonical.origin);
	return new Response(null, {
		status: 302,
		headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
	});
}

/**
 * Where the browser goes after the OAuth callback, from `AUTH_REDIRECT_URL`
 * (e.g. https://admin.pphat.me/auth/callback). Config only, never a request
 * parameter, so it cannot become an open redirect. Null keeps the JSON
 * response (API clients, tests).
 * @param { Pick<Env, 'AUTH_REDIRECT_URL'> } env Worker env
 * @returns { URL | null } The validated http(s) target, or null when unset/invalid
 */
export function authRedirectTarget(env: Pick<Env, 'AUTH_REDIRECT_URL'>): URL | null {
	if (!env.AUTH_REDIRECT_URL) return null;
	try {
		const url = new URL(env.AUTH_REDIRECT_URL);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
	} catch {
		return null;
	}
}

/**
 * @description 302 to `target` with values in the URL fragment. Fragments are
 * never sent to servers or logged, so tokens stay out of access logs.
 * @param { URL } target Redirect target (from authRedirectTarget)
 * @param { Record<string, string> } values Fragment parameters
 * @returns { Response }
 */
export function redirectWithFragment(target: URL, values: Record<string, string>): Response {
	const url = new URL(target);
	url.hash = new URLSearchParams(values).toString();
	return new Response(null, {
		status: 302,
		headers: { Location: url.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
	});
}
