import type { Context, Next } from 'hono';
import { json } from '../shared/helpers/json';

/**
 * Hard cap on any request body reaching our route handlers. 100 KB is
 * generous for JSON payloads (a maxed-out article `content` field is 100 KB
 * per #27) but low enough to make a resource-exhaustion attack via giant
 * bodies uninteresting. GET/HEAD/OPTIONS are unaffected.
 */
const MAX_BODY_BYTES = 100 * 1024;

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * @description Hono middleware that rejects any body-carrying request larger
 * than `MAX_BODY_BYTES` with 413 Payload Too Large. Reads the `Content-Length`
 * header; requests without a length header pass through — the AI / chat
 * validators already cap their own inputs and the Workers runtime won't hand
 * us an unbounded body.
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function bodyLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
	if (!METHODS_WITH_BODY.has(c.req.method)) return next();

	const raw = c.req.header('content-length');
	if (!raw) return next();

	const bytes = Number.parseInt(raw, 10);
	if (Number.isFinite(bytes) && bytes > MAX_BODY_BYTES) {
		return json(
			{ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` },
			413,
		);
	}

	return next();
}
