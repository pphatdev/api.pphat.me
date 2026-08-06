// Declaration-merged onto the generated `Env` interface in
// `worker-configuration.d.ts`. Kept in a separate file so `wrangler types`
// can regenerate the base without stomping these additions.
//
// Optional (?) because tests, local dev, and any deployment that hasn't yet
// provisioned the Rate Limiting bindings will not have these on `env`. The
// middleware handles absence by failing open (see rate-limit.middleware.ts).

interface __RateLimiterBindings {
	RATE_LIMITER_AUTH?: RateLimit;
	RATE_LIMITER_READ?: RateLimit;
	RATE_LIMITER_WRITE?: RateLimit;
	RATE_LIMITER_ENGAGEMENT?: RateLimit;
	RATE_LIMITER_CONTACT?: RateLimit;
}

interface __ExtraSecrets {
	/**
	 * Optional secret for HMAC-hashing visitor IPs in `visitor_logs.ip_hash`
	 * (#22). Set with `wrangler secret put IP_HASH_SECRET`. Without it, the
	 * middleware falls back to plain SHA-256, which is still deterministic and
	 * brute-forceable against the IPv4 space.
	 */
	IP_HASH_SECRET?: string;
}

interface Env extends __RateLimiterBindings, __ExtraSecrets {}
declare namespace Cloudflare {
	interface Env extends __RateLimiterBindings, __ExtraSecrets {}
}
