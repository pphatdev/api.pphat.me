import type { Context, Next } from 'hono';

/**
 * Edge cache for public content reads (Cloudflare Cache API, per colo).
 *
 * Goals: keep repeat visitors and bots off the database, and keep serving
 * content when the database fails (quota exceeded, network, timeout).
 *
 * - Cached: GET on public content routes (CACHEABLE_PATH), 200 JSON only.
 * - Fresh for `API_CACHE_TTL` seconds (default 60). After that the request
 *   goes to the database and the cache is refreshed.
 * - Stale-if-error: a stored copy is kept for 24h. If the handler returns
 *   5xx (e.g. D1/Turso quota error), the stale copy is served with
 *   `X-Cache: STALE-IF-ERROR` and the error is logged.
 * - Callers never share entries across credentials: Bearer (JWT) callers
 *   bypass the cache entirely; API-key callers (e.g. the blog server) get a
 *   scope keyed by a hash of their key; anonymous callers share one scope.
 * - Invalidation: a successful write to a cacheable route bumps a per-colo
 *   generation that is part of every key, so the writer's colo serves fresh
 *   data immediately; other colos refresh within the TTL. (Instant global
 *   purge would need the Cloudflare purge API + a zone token.)
 *
 * Set `API_CACHE_TTL=0` to disable (tests do).
 */

const CACHE_ORIGIN = 'https://api-cache.internal';
const GENERATION_KEY = `${CACHE_ORIGIN}/__generation`;
const DEFAULT_FRESH_SECONDS = 60;
const STALE_SECONDS = 24 * 60 * 60;
const STORED_AT_HEADER = 'x-api-cache-stored-at';

/** Public content routes whose GET responses are identical for every caller in a scope. */
const CACHEABLE_PATH = /^\/v1\/api\/(articles|projects|tags|authors|faqs|gallery|services|about-me|experiences|skills|tech-stacks)(\/|$)/;

/**
 * @description Fresh TTL in seconds from `API_CACHE_TTL` (0 disables caching).
 * @param { Pick<Env, 'API_CACHE_TTL'> } env Worker env
 * @returns { number }
 */
export function cacheFreshSeconds(env: Pick<Env, 'API_CACHE_TTL'>): number {
	if (env.API_CACHE_TTL === undefined || env.API_CACHE_TTL === '') return DEFAULT_FRESH_SECONDS;
	const n = Number(env.API_CACHE_TTL);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FRESH_SECONDS;
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description Cache scope for a request: 'anon', a hash of the API key, or
 * null when the caller must bypass the cache (Bearer JWT / `?token=`).
 * @param { Request } request The incoming request
 * @returns { Promise<string | null> }
 */
export async function cacheScope(request: Request): Promise<string | null> {
	const auth = request.headers.get('authorization')?.trim() ?? '';
	if (/^bearer\s/i.test(auth)) return null;
	if (new URL(request.url).searchParams.has('token')) return null;
	const apiKey = /^apikey\s/i.test(auth) ? auth.slice(7).trim() : request.headers.get('x-api-key')?.trim();
	if (apiKey) return `key-${(await sha256Hex(apiKey)).slice(0, 32)}`;
	return 'anon';
}

async function currentGeneration(cache: Cache): Promise<string> {
	const hit = await cache.match(GENERATION_KEY);
	return hit ? await hit.text() : '0';
}

async function bumpGeneration(cache: Cache): Promise<void> {
	await cache.put(
		GENERATION_KEY,
		new Response(String(Date.now()), { headers: { 'Cache-Control': `public, s-maxage=${STALE_SECONDS}` } }),
	);
}

/** Copy a response with client-facing cache headers. */
function forClient(response: Response, status: 'HIT' | 'MISS' | 'STALE-IF-ERROR', scope: string, ttl: number): Response {
	const out = new Response(response.body, response);
	out.headers.delete(STORED_AT_HEADER);
	out.headers.set('X-Cache', status);
	out.headers.set('Cache-Control', scope === 'anon' ? `public, max-age=${ttl}` : 'private, no-store');
	if (scope !== 'anon') out.headers.append('Vary', 'Authorization, X-API-Key');
	return out;
}

/**
 * @description Hono middleware implementing the edge cache described above.
 * @param { Context } c Hono context
 * @param { Next } next Next middleware
 * @returns { Promise<Response | void> }
 */
export async function apiCacheMiddleware(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
	const ttl = cacheFreshSeconds(c.env);
	if (ttl === 0 || typeof caches === 'undefined') return next();

	const cache = caches.default;
	const url = new URL(c.req.url);
	const cacheablePath = CACHEABLE_PATH.test(url.pathname);

	// Writes: refresh this colo's entries once the change has succeeded.
	if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
		await next();
		if (cacheablePath && c.res.status < 400) {
			c.executionCtx.waitUntil(bumpGeneration(cache).catch((err) => console.error('[cache] generation bump failed', err)));
		}
		return;
	}
	if (c.req.method !== 'GET' || !cacheablePath) return next();

	const scope = await cacheScope(c.req.raw);
	if (!scope) return next();

	const key = new Request(`${CACHE_ORIGIN}/${await currentGeneration(cache)}/${scope}${url.pathname}${url.search}`);
	const cached = await cache.match(key);
	const storedAt = Number(cached?.headers.get(STORED_AT_HEADER) ?? 0);
	if (cached && Date.now() - storedAt < ttl * 1000) return forClient(cached, 'HIT', scope, ttl);

	await next();
	const res = c.res;

	if (res.status >= 500) {
		if (cached) {
			console.error(`[cache] ${url.pathname} returned ${res.status}; serving stale copy from ${new Date(storedAt).toISOString()}`);
			c.res = forClient(cached, 'STALE-IF-ERROR', scope, ttl);
		}
		return;
	}

	const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
	if (res.status === 200 && isJson && !res.headers.has('set-cookie')) {
		const stored = res.clone();
		const headers = new Headers(stored.headers);
		headers.set('Cache-Control', `public, s-maxage=${STALE_SECONDS}`);
		headers.set(STORED_AT_HEADER, String(Date.now()));
		c.executionCtx.waitUntil(
			cache.put(key, new Response(stored.body, { status: 200, headers })).catch((err) => console.error('[cache] put failed', err)),
		);
		c.res = forClient(res, 'MISS', scope, ttl);
	}
}
