import type { Context, Next } from 'hono';

type ApiType = 'auth' | 'read' | 'write' | 'engagement' | 'contact';

/**
 * Map each API type to the binding name declared in `wrangler.jsonc`. The
 * limit + window for each policy is set at deploy time on the binding itself
 * (Rate Limiting bindings do not accept dynamic limits), so this file only
 * routes requests to the right binding — it does not carry any numeric limits.
 */
const BINDING_BY_TYPE: Record<ApiType, keyof Env> = {
	auth: 'RATE_LIMITER_AUTH',
	read: 'RATE_LIMITER_READ',
	write: 'RATE_LIMITER_WRITE',
	engagement: 'RATE_LIMITER_ENGAGEMENT',
	contact: 'RATE_LIMITER_CONTACT',
};

// Warn once per missing binding so a misconfigured deploy is obvious in logs
// without flooding on every request.
const warned = new Set<string>();

/**
 * @description Check if the route is an engagement route
 * @param { string } pathname The URL pathname
 * @returns { boolean } True if engagement route
 */
function isEngagementRoute(pathname: string): boolean {
	return (
		pathname.includes('/comments') ||
		pathname.includes('/reactions') ||
		pathname.endsWith('/stats/view')
	);
}

/**
 * @description Determine the API type for rate limiting
 * @param { Request } request The incoming request
 * @returns { ApiType | null } The API type or null
 */
function getApiType(request: Request): ApiType | null {
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith('/v1/api/')) return null;
	if (pathname.startsWith('/v1/api/auth/')) return 'auth';
	if (pathname === '/v1/api/contact') return 'contact';
	if (request.method === 'GET' || request.method === 'HEAD') return 'read';
	return isEngagementRoute(pathname) ? 'engagement' : 'write';
}

/**
 * @description Get client identity (IP) from request
 * @param { Request } request The incoming request
 * @returns { string } The client identifier
 */
function getClientIdentity(request: Request): string {
	const ip = request.headers.get('cf-connecting-ip');
	if (ip) return ip;
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
	return 'unknown';
}

/**
 * @description Hono middleware for rate limiting. Delegates to a per-type
 * Cloudflare Rate Limiting binding for atomic, cross-isolate counting. Fails
 * open (with a one-time warning) if the binding is missing so tests and dev
 * environments without a binding still function.
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
	const apiType = getApiType(c.req.raw);
	if (!apiType) return next();

	const bindingName = BINDING_BY_TYPE[apiType];
	const binding = (c.env as any)[bindingName] as RateLimit | undefined;

	if (!binding || typeof binding.limit !== 'function') {
		if (!warned.has(bindingName)) {
			warned.add(bindingName);
			console.warn(`[rate-limit] binding "${bindingName}" is not configured — allowing requests`);
		}
		return next();
	}

	const key = getClientIdentity(c.req.raw);
	const outcome = await binding.limit({ key });

	if (!outcome.success) {
		return c.json(
			{ error: `Too Many Requests for ${apiType} API type` },
			429,
			{
				'Retry-After': '60',
				'X-RateLimit-Policy': apiType,
			},
		);
	}

	return next();
}
