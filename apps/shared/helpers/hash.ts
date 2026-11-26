// Cache imported HMAC keys per secret for the lifetime of the isolate so
// importKey does not run on every request.
const keyCache = new Map<string, CryptoKey>();
const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description HMAC-SHA-256 of `data` keyed with `secret`, as lowercase hex
 * @param { string } secret The HMAC key
 * @param { string } data The message
 * @returns { Promise<string> } Hex digest
 */
export async function hmacHex(secret: string, data: string): Promise<string> {
	let key = keyCache.get(secret);
	if (!key) {
		key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
		keyCache.set(secret, key);
	}
	return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
