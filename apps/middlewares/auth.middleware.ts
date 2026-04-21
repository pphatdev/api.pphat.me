import type { Context, Next } from 'hono';
import { verifyJwt } from "../modules/auth/auth.service";
import type { JwtPayload } from "../modules/auth/auth.interface";
import { json } from "../shared/helpers/json";

/**
 * Hono middleware that enforces Bearer JWT authentication.
 * Sets `user` (JwtPayload) in context variables on success.
 */
export async function authGuard(c: Context<any>, next: Next): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
	const token = authHeader.slice(7);
	const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
	if (!payload) return json({ error: "Invalid or expired token" }, 401);
	c.set('user', payload as JwtPayload);
	return next();
}

/**
 * Hono middleware that optionally parses Bearer JWT.
 * Sets `user` in context if token is valid; proceeds without error if absent/invalid.
 */
export async function optionalAuth(c: Context<any>, next: Next): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const payload = await verifyJwt(token, (c.env as Env).JWT_SECRET);
		if (payload) c.set('user', payload as JwtPayload);
	}
	return next();
}
