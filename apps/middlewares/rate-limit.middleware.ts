import type { Context, Next } from 'hono';

type ApiType = 'auth' | 'read' | 'write' | 'engagement' | 'contact';

interface RateLimitPolicy {
	limit: number;
	windowMs: number;
}

interface RateLimitCounter {
	count: number;
	resetAt: number;
}

const RATE_LIMITS: Record<ApiType, RateLimitPolicy> = {
	auth: { limit: parseInt(process.env.RATE_AUTH ?? '500'), windowMs: 60 * 60 * 1000 },
	read: { limit: parseInt(process.env.RATE_READ ?? '500'), windowMs: 60 * 60 * 1000 },
	write: { limit: parseInt(process.env.RATE_WRITE ?? '500'), windowMs: 60 * 60 * 1000 },
	engagement: { limit: parseInt(process.env.RATE_ENGAGEMENT ?? '500'), windowMs: 60 * 60 * 1000 },
	contact: { limit: parseInt(process.env.RATE_CONTACT ?? '500'), windowMs: 24 * 60 * 60 * 1000 }, // 5 requests per 24 hours
};

const counters = new Map<string, RateLimitCounter>();

function isEngagementRoute(pathname: string): boolean {
	return (
		pathname.includes('/comments') ||
		pathname.includes('/reactions') ||
		pathname.endsWith('/stats/view')
	);
}

function getApiType(request: Request): ApiType | null {
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith('/v1/api/')) return null;
	if (pathname.startsWith('/v1/api/auth/')) return 'auth';
	if (pathname === '/v1/api/contact') return 'contact';
	if (request.method === 'GET' || request.method === 'HEAD') return 'read';
	return isEngagementRoute(pathname) ? 'engagement' : 'write';
}

function getClientIdentity(request: Request): string {
	const ip = request.headers.get('cf-connecting-ip');
	if (ip) return ip;
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
	return 'unknown';
}

export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
	const apiType = getApiType(c.req.raw);
	if (!apiType) return next();

	const policy = RATE_LIMITS[apiType];
	const key = `${apiType}:${getClientIdentity(c.req.raw)}`;
	const now = Date.now();

	const current = counters.get(key);
	const counter = !current || now >= current.resetAt
		? { count: 0, resetAt: now + policy.windowMs }
		: current;

	counter.count += 1;
	counters.set(key, counter);

	const remaining = Math.max(0, policy.limit - counter.count);
	const resetIn = Math.max(0, Math.ceil((counter.resetAt - now) / 1000));

	if (counter.count > policy.limit) {
		return c.json(
			{ error: `Too Many Requests for ${apiType} API type` },
			429,
			{
				'X-RateLimit-Limit': String(policy.limit),
				'X-RateLimit-Remaining': '0',
				'X-RateLimit-Reset': String(resetIn),
				'Retry-After': String(resetIn),
			},
		);
	}

	await next();

	c.header('X-RateLimit-Limit', String(policy.limit));
	c.header('X-RateLimit-Remaining', String(remaining));
	c.header('X-RateLimit-Reset', String(resetIn));
}
