import { Context, Next } from 'hono';

export async function trafficMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
	// Only log GET requests to public pages or API calls to track traffic
	if (c.req.method !== 'GET') return next();

	const ip = c.req.header('CF-Connecting-IP') || 'unknown';
	const path = new URL(c.req.url).pathname;
	const timestamp = new Date().toISOString();

	// Simple hash for IP to avoid storing PII directly
	const ipHash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(ip))
		.then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

	// Log asynchronously so it doesn't slow down the response
	c.executionCtx.waitUntil(
		c.env.DB.prepare("INSERT INTO visitor_logs (timestamp, ip_hash, path) VALUES (?1, ?2, ?3)")
			.bind(timestamp, ipHash, path)
			.run()
			.catch(err => console.error("Failed to log traffic:", err))
	);

	return next();
}
