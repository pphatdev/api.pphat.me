import type { Context, Next } from 'hono';
import { verifyJwt } from "../modules/auth/auth.service";
import { json } from "../shared/helpers/json";

/**
 * Returns null if the request carries a valid Bearer JWT.
 * Returns a 401 Response otherwise — callers should propagate it immediately.
 */
export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
	const token = authHeader.slice(7);
	const payload = await verifyJwt(token, env.JWT_SECRET);
	if (!payload) return json({ error: "Invalid or expired token" }, 401);
	return null;
}

/**
 * Hono middleware that enforces Bearer JWT authentication.
 * Compatible with any Hono app that has Env bindings.
 */
export async function authGuard(c: Context<any>, next: Next): Promise<Response | void> {
	const err = await requireAuth(c.req.raw, c.env as Env);
	if (err) return err;
	return next();
}
