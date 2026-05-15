import type { Context, Next } from 'hono';
import { verifyJwt } from "../modules/auth/auth.service";
import type { JwtPayload } from "../modules/auth/auth.interface";
import { json } from "../shared/helpers/json";

/**
 * @description Hono middleware that enforces Bearer JWT authentication
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function authGuard(c: Context<any>, next: Next): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");
	let token = '';

	if (authHeader?.startsWith("Bearer ")) {
		token = authHeader.slice(7);
	} else {
		// Fallback to query parameter for EventSource/SSE support
		token = c.req.query("token") || '';
	}

	if (!token) return json({ error: "Unauthorized" }, 401);
	const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
	if (!payload || payload.type === 'refresh') return json({ error: "Invalid or expired token" }, 401);
	c.set('user', payload as JwtPayload);
	return next();
}

/**
 * @description Hono middleware that optionally parses Bearer JWT
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function optionalAuth(c: Context<any>, next: Next): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
		if (payload && payload.type !== 'refresh') c.set('user', payload as JwtPayload);
	}
	return next();
}
