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

/** Parse an http(s) URL, or null. */
function httpUrl(value: string | null | undefined): URL | null {
	if (!value) return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
	} catch {
		return null;
	}
}

/**
 * @description Allowed post-sign-in destinations: AUTH_REDIRECT_URL (the
 * default) plus the comma-separated AUTH_REDIRECT_ALLOWLIST. Config only, so
 * neither can become an open redirect.
 * @param { Pick<Env, 'AUTH_REDIRECT_URL' | 'AUTH_REDIRECT_ALLOWLIST'> } env Worker env
 * @returns { URL[] } Default first; invalid entries dropped
 */
export function authRedirectAllowlist(env: Pick<Env, 'AUTH_REDIRECT_URL' | 'AUTH_REDIRECT_ALLOWLIST'>): URL[] {
	const entries = [env.AUTH_REDIRECT_URL, ...(env.AUTH_REDIRECT_ALLOWLIST ?? '').split(',')];
	const seen = new Set<string>();
	const out: URL[] = [];
	for (const entry of entries) {
		const url = httpUrl(entry);
		if (url && !seen.has(url.href)) {
			seen.add(url.href);
			out.push(url);
		}
	}
	return out;
}

/**
 * Where the browser goes after the OAuth callback. Null keeps the JSON
 * response (API clients, tests).
 * @param { Pick<Env, 'AUTH_REDIRECT_URL' | 'AUTH_REDIRECT_ALLOWLIST'> } env Worker env
 * @param { string } [returnTo] A requested target (from `?return_to=` or the state); used only if allowlisted
 * @returns { URL | null } The requested target if allowed, else AUTH_REDIRECT_URL, else null
 */
export function authRedirectTarget(
	env: Pick<Env, 'AUTH_REDIRECT_URL' | 'AUTH_REDIRECT_ALLOWLIST'>,
	returnTo?: string | null,
): URL | null {
	const allowed = authRedirectAllowlist(env);
	const requested = httpUrl(returnTo);
	if (requested) {
		const match = allowed.find((url) => url.href === requested.href);
		if (match) return match;
	}
	return httpUrl(env.AUTH_REDIRECT_URL);
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
