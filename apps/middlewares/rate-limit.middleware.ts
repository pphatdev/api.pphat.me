type ApiType = "auth" | "read" | "write" | "engagement";

interface RateLimitPolicy {
	limit: number;
	windowMs: number;
}

interface RateLimitCounter {
	count: number;
	resetAt: number;
}

interface RateLimitStore {
	get(key: string): RateLimitCounter | undefined;
	set(key: string, value: RateLimitCounter): void;
}

export interface RateLimitResult {
	response: Response | null;
	headers: Headers;
}

const RATE_LIMITS: Record<ApiType, RateLimitPolicy> = {
	auth: { limit: 20, windowMs: 60_000 },
	read: { limit: 300, windowMs: 60_000 },
	write: { limit: 60, windowMs: 60_000 },
	engagement: { limit: 120, windowMs: 60_000 },
};

const counters = new Map<string, RateLimitCounter>();

function getApiType(request: Request): ApiType | null {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/v1/api/")) return null;

	if (url.pathname.startsWith("/v1/api/auth/")) return "auth";

	if (request.method === "GET" || request.method === "HEAD") return "read";

	if (
		url.pathname.includes("/comments") ||
		url.pathname.includes("/reactions") ||
		url.pathname.endsWith("/stats/view")
	) {
		return "engagement";
	}

	return "write";
}

function getClientIdentity(request: Request): string {
	const connectingIp = request.headers.get("cf-connecting-ip");
	if (connectingIp) return connectingIp;

	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

	return "unknown";
}

function toHeaders(policy: RateLimitPolicy, remaining: number, resetAt: number): Headers {
	const resetIn = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
	return new Headers({
		"X-RateLimit-Limit": String(policy.limit),
		"X-RateLimit-Remaining": String(Math.max(0, remaining)),
		"X-RateLimit-Reset": String(resetIn),
	});
}

export function applyApiTypeRateLimit(request: Request, store: RateLimitStore = counters): RateLimitResult {
	const apiType = getApiType(request);
	if (!apiType) return { response: null, headers: new Headers() };

	const policy = RATE_LIMITS[apiType];
	const key = `${apiType}:${getClientIdentity(request)}`;
	const now = Date.now();

	const current = store.get(key);
	const counter = !current || now >= current.resetAt
		? { count: 0, resetAt: now + policy.windowMs }
		: current;

	counter.count += 1;
	store.set(key, counter);

	const remaining = policy.limit - counter.count;
	const headers = toHeaders(policy, remaining, counter.resetAt);

	if (counter.count > policy.limit) {
		headers.set("Retry-After", headers.get("X-RateLimit-Reset") ?? "1");
		return {
			response: new Response(
				JSON.stringify({ error: `Too Many Requests for ${apiType} API type` }),
				{ status: 429, headers: { "Content-Type": "application/json", ...Object.fromEntries(headers) } },
			),
			headers,
		};
	}

	return { response: null, headers };
}

export function attachRateLimitHeaders(response: Response, rateHeaders: Headers): Response {
	if (rateHeaders.entries().next().done) return response;
	const headers = new Headers(response.headers);
	rateHeaders.forEach((value, key) => headers.set(key, value));
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
