import type { Context, Next } from 'hono';
import { AuthService, verifyJwt } from "../modules/auth/auth.service";
import { AuthRepository } from "../modules/auth/auth.repo";
import type { JwtPayload, User } from "../modules/auth/auth.interface";
import { json } from "../shared/helpers/json";

/**
 * @description Build a JwtPayload-shaped session object from a user record loaded via API key
 * @param { User } user The authenticated user
 * @returns { JwtPayload } Session payload with sub, provider, email, name, role
 */
function sessionFromUser(user: User): JwtPayload {
	const now = Math.floor(Date.now() / 1000);
	return {
		sub: user.id,
		provider: user.provider,
		email: user.email,
		name: user.name,
		role: user.role ?? 'user',
		type: 'access',
		iat: now,
		exp: now,
	};
}

/**
 * @description Extract an API key from the request (Authorization: ApiKey ... or X-API-Key)
 * @param { Context } c The Hono context
 * @returns { string } The raw key or an empty string
 */
function extractApiKey(c: Context<any>): string {
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("ApiKey ")) return authHeader.slice(7).trim();
	const headerKey = c.req.header("X-API-Key");
	if (headerKey) return headerKey.trim();
	return '';
}

/**
 * @description Shared auth-resolution used by both authGuard and sseAuthGuard.
 * Accepts an API key (Authorization: ApiKey / X-API-Key) or a Bearer JWT. When
 * `allowQueryToken` is true, also accepts a JWT via the `?token=` query param
 * — intended only for EventSource / SSE clients that cannot set headers.
 * @param { Context } c The Hono context
 * @param { boolean } allowQueryToken Permit `?token=` fallback
 * @returns { Promise<JwtPayload | Response> } Session payload on success, or an error Response
 */
async function resolveAuth(c: Context<any>, allowQueryToken: boolean): Promise<JwtPayload | Response> {
	const apiKey = extractApiKey(c);
	if (apiKey) {
		const repo = new AuthRepository((c.env as Env).DB);
		const user = await new AuthService(repo).verifyApiKey(apiKey);
		if (!user) return json({ error: "Invalid or revoked API key" }, 401);
		return sessionFromUser(user);
	}

	const authHeader = c.req.header("Authorization");
	let token = '';
	if (authHeader?.startsWith("Bearer ")) {
		token = authHeader.slice(7);
	} else if (allowQueryToken) {
		token = c.req.query("token") || '';
	}

	if (!token) return json({ error: "Unauthorized" }, 401);
	const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
	if (!payload || payload.type === 'refresh') return json({ error: "Invalid or expired token" }, 401);

	// Access-token revocation floor (#12). If the user has logged out since
	// this token was minted, its `iat` will be earlier than the floor and we
	// must reject. `getSessionInvalidatedAt` returns null when the user has
	// never logged out — skip the check to save a round-trip.
	const floor = await new AuthRepository((c.env as Env).DB).getSessionInvalidatedAt(payload.sub);
	if (floor !== null && payload.iat < floor) {
		return json({ error: "Session invalidated. Please sign in again." }, 401);
	}

	return payload as JwtPayload;
}

/**
 * @description Hono middleware that enforces Bearer JWT or API key authentication.
 * Does NOT accept `?token=` in the query string — use `sseAuthGuard` for the
 * one SSE route that needs an EventSource-compatible fallback.
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function authGuard(c: Context<any>, next: Next): Promise<Response | void> {
	const result = await resolveAuth(c, false);
	if (result instanceof Response) return result;
	c.set('user', result);
	return next();
}

/**
 * @description Hono middleware for SSE endpoints that must accept `?token=` in
 * the query string because `EventSource` cannot set request headers. Accepts
 * everything `authGuard` accepts, plus the query fallback. Do NOT reuse for
 * non-streaming routes — query tokens leak into referrer headers and server
 * access logs.
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function sseAuthGuard(c: Context<any>, next: Next): Promise<Response | void> {
	const result = await resolveAuth(c, true);
	if (result instanceof Response) return result;
	c.set('user', result);
	return next();
}

/**
 * @description Hono middleware that requires the caller to be an admin.
 * Must run after `authGuard` — relies on `c.get('user')` being populated.
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function requireAdmin(c: Context<any>, next: Next): Promise<Response | void> {
	const user = c.get('user') as JwtPayload | undefined;
	if (!user) return json({ error: "Unauthorized" }, 401);
	if (user.role !== 'admin') return json({ error: "Admin privileges required" }, 403);
	return next();
}

/**
 * @description Hono middleware that optionally parses Bearer JWT or API key
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function optionalAuth(c: Context<any>, next: Next): Promise<Response | void> {
	const apiKey = extractApiKey(c);
	if (apiKey) {
		const repo = new AuthRepository((c.env as Env).DB);
		const user = await new AuthService(repo).verifyApiKey(apiKey);
		if (user) c.set('user', sessionFromUser(user));
		return next();
	}

	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
		if (payload && payload.type !== 'refresh') {
			// Same invalidation-floor check as authGuard, but silently drop the
			// session instead of 401ing — optionalAuth callers treat "no user"
			// as anonymous, which is the correct behaviour post-logout.
			const floor = await new AuthRepository((c.env as Env).DB).getSessionInvalidatedAt(payload.sub);
			if (floor === null || payload.iat >= floor) {
				c.set('user', payload as JwtPayload);
			}
		}
	}
	return next();
}
