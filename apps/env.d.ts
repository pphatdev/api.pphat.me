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
	/**
	 * Shared secret the admin panel's proxy (admin.pphat.me/backend/*) sends in
	 * `X-Admin-Proxy-Secret`. When it matches, the API trusts the forwarded
	 * `X-Admin-Client-IP` for rate limiting and traffic logs. Set with
	 * `wrangler secret put ADMIN_PROXY_SECRET` (same value on both Workers).
	 */
	ADMIN_PROXY_SECRET?: string;
	/**
	 * Database driver: `d1` (default) or `turso`. With `turso`, `env.DB` is
	 * swapped for a D1-compatible libSQL adapter (apps/shared/db).
	 */
	DB_DRIVER?: 'd1' | 'turso' | (string & {});
	/** Turso database URL, e.g. `libsql://<db>-<org>.turso.io`. Secret. */
	TURSO_DATABASE_URL?: string;
	/** Turso auth token (`turso db tokens create <db>`). Secret. */
	TURSO_AUTH_TOKEN?: string;
	/** Fresh TTL (seconds) of the public-read edge cache; `0` disables it. Default 60. */
	API_CACHE_TTL?: string;
	/** `1` logs rows read per query and warns above 1,000 (development only). */
	DB_QUERY_LOG?: string;
}

interface Env extends __RateLimiterBindings, __ExtraSecrets {}
declare namespace Cloudflare {
	interface Env extends __RateLimiterBindings, __ExtraSecrets {}
}
