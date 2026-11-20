/**
 * Resolve the real client IP for a request.
 *
 * The admin panel (admin.pphat.me) proxies browser calls through its own
 * Worker, so `CF-Connecting-IP` on those requests is the admin Worker, not the
 * user. The proxy forwards the user's IP in `X-Admin-Client-IP` together with
 * `X-Admin-Proxy-Secret`. The forwarded IP is trusted ONLY when that secret
 * matches `ADMIN_PROXY_SECRET`; otherwise the headers are ignored, so a public
 * caller cannot spoof its IP to dodge rate limits.
 */

export const ADMIN_PROXY_SECRET_HEADER = 'x-admin-proxy-secret';
export const ADMIN_CLIENT_IP_HEADER = 'x-admin-client-ip';

const encoder = new TextEncoder();

/**
 * @description Constant-time string comparison (avoids leaking the secret via timing)
 * @param { string } a First value
 * @param { string } b Second value
 * @returns { boolean } True when equal
 */
function safeEqual(a: string, b: string): boolean {
	const left = encoder.encode(a);
	const right = encoder.encode(b);
	if (left.byteLength !== right.byteLength) return false;
	const subtle = crypto.subtle as SubtleCrypto & {
		timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean;
	};
	if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(left, right);
	let diff = 0;
	for (let i = 0; i < left.byteLength; i++) diff |= left[i]! ^ right[i]!;
	return diff === 0;
}

/**
 * @description True when the request comes from the trusted admin proxy
 * @param { Request } request The incoming request
 * @param { string | undefined } secret The configured `ADMIN_PROXY_SECRET`
 * @returns { boolean }
 */
export function isTrustedAdminProxy(request: Request, secret: string | undefined): boolean {
	if (!secret) return false;
	const presented = request.headers.get(ADMIN_PROXY_SECRET_HEADER);
	return presented !== null && safeEqual(presented, secret);
}

/**
 * @description Get the client IP, honouring the admin proxy's forwarded IP when trusted
 * @param { Request } request The incoming request
 * @param { string | undefined } secret The configured `ADMIN_PROXY_SECRET`
 * @returns { string | null } The client IP, or null if unknown
 */
export function getClientIp(request: Request, secret: string | undefined): string | null {
	if (isTrustedAdminProxy(request, secret)) {
		const forwarded = request.headers.get(ADMIN_CLIENT_IP_HEADER)?.trim();
		if (forwarded) return forwarded;
	}
	const ip = request.headers.get('cf-connecting-ip');
	if (ip) return ip;
	const forwardedFor = request.headers.get('x-forwarded-for');
	return forwardedFor?.split(',')[0]?.trim() || null;
}
