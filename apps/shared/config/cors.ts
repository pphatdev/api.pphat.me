/**
 * Origins allowed by the CORS middleware (#23). Explicit hostnames only —
 * the previous `*.vercel.app` wildcard let any preview domain (including
 * someone else's app on Vercel free tier) call the API with the caller's
 * credentials attached. Add new hosts here rather than widening the pattern.
 *
 * Localhost is permitted on any port for local dev; the origin builder
 * handles that separately so we don't need to enumerate ports here.
 */
const ALLOWED_ORIGINS: readonly string[] = [
	'https://pphat.me',
	'https://www.pphat.me',
	'https://api.pphat.me',
	// Add explicit preview / staging hosts here as they come up:
	// 'https://api-pphat-me-preview.vercel.app',
];

/**
 * @description Decide the value for the `Access-Control-Allow-Origin` header
 * on a given request origin. Returns the origin echoed back when allowed,
 * `null` when disallowed (Hono cors will then omit the header entirely).
 * @param { string | null | undefined } origin The request's `Origin` header
 * @returns { string | null } Origin to echo, or null to deny
 */
export function resolveAllowedOrigin(origin: string | null | undefined): string | null {
	// Same-origin / non-browser callers omit `Origin`. Nothing to grant.
	if (!origin) return null;
	if (ALLOWED_ORIGINS.includes(origin)) return origin;
	// Local dev: any http://localhost:<port> or http://127.0.0.1:<port>.
	try {
		const url = new URL(origin);
		if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
			return origin;
		}
	} catch {
		// Malformed Origin header — deny.
	}
	return null;
}
