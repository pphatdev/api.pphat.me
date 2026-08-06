import { Context, Next } from 'hono';

// Cache the imported HMAC key per (env instance, secret) so we don't re-run
// importKey on every request. Workers keep the module scope for the lifetime
// of the isolate — good enough.
const keyCache = new WeakMap<Env, { secret: string; key: CryptoKey }>();

/**
 * @description Compute HMAC-SHA-256(ip, secret) as hex. Falls back to plain
 * SHA-256 when no secret is configured — better than SHA-1 (the previous
 * default) but note that without a secret, the hash is still deterministic
 * across deployments, so any leaked dump can be brute-forced against the
 * ~4 billion IPv4 space.
 * @param { Env } env Environment bindings
 * @param { string } ip Raw IP string
 * @returns { Promise<string> } Hex digest
 */
async function hashIp(env: Env, ip: string): Promise<string> {
	const encoder = new TextEncoder();
	const secret = (env as any).IP_HASH_SECRET as string | undefined;

	if (!secret) {
		const buf = await crypto.subtle.digest('SHA-256', encoder.encode(ip));
		return toHex(buf);
	}

	let cached = keyCache.get(env);
	if (!cached || cached.secret !== secret) {
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign'],
		);
		cached = { secret, key };
		keyCache.set(env, cached);
	}
	const sig = await crypto.subtle.sign('HMAC', cached.key, encoder.encode(ip));
	return toHex(sig);
}

function toHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description Hono middleware to track visitor traffic
 * @param { Context } c The Hono context
 * @param { Next } next The next middleware
 * @returns { Promise<Response | void> }
 */
export async function trafficMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
	// Only log GET requests to public pages or API calls to track traffic
	if (c.req.method !== 'GET') return next();

	const ip = c.req.header('CF-Connecting-IP') || 'unknown';
	const path = new URL(c.req.url).pathname;
	const timestamp = new Date().toISOString();

	const ipHash = await hashIp(c.env, ip);

	// Log asynchronously so it doesn't slow down the response
	c.executionCtx.waitUntil(
		c.env.DB.prepare("INSERT INTO visitor_logs (timestamp, ip_hash, path) VALUES (?1, ?2, ?3)")
			.bind(timestamp, ipHash, path)
			.run()
			.catch(err => console.error("Failed to log traffic:", err))
	);

	return next();
}
