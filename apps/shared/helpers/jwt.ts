import { sign, verify } from 'hono/jwt';
import type { SignatureAlgorithm } from 'hono/utils/jwt/jwa';

/**
 * We only ever sign with HS256; asserting the token header's `alg` matches
 * this constant on verify closes the "algorithm confusion" attack surface
 * (e.g., an attacker submitting a token with `alg: none` or an RS/HS mix-up).
 * hono/jwt already enforces this internally, but doing it explicitly here
 * means the guarantee survives even if a future refactor drops the `alg`
 * argument from the `verify(...)` call.
 */
const PINNED_ALG: SignatureAlgorithm = 'HS256';

export interface JwtOptions {
	secret: string;
	alg?: SignatureAlgorithm;
	expiresIn?: number; // seconds
	iss?: string;
	aud?: string;
}

/**
 * @description Decode the header segment of a compact JWS token without
 * verifying the signature. Used only for the alg / typ pre-check before we
 * hand the token to `hono/jwt`'s verifier.
 * @param { string } token Compact JWS token
 * @returns { Record<string, unknown> | null } Decoded header or null on parse failure
 */
function decodeJwtHeader(token: string): Record<string, unknown> | null {
	const segment = token.split('.')[0];
	if (!segment) return null;
	try {
		// atob doesn't accept URL-safe base64 alphabet, so translate first.
		const b64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
		return JSON.parse(atob(b64));
	} catch {
		return null;
	}
}

export class JwtService {
	private secret: string;
	private alg: SignatureAlgorithm;
	private expiresIn: number;
	private iss?: string;
	private aud?: string;

	constructor(options: JwtOptions) {
		this.secret = options.secret;
		this.alg = options.alg || 'HS256';
		this.expiresIn = options.expiresIn || 60 * 60 * 24 * 7; // 7 days default
		this.iss = options.iss;
		this.aud = options.aud;
	}

	/**
	 * @description Generates a JWT token
	 * @param { Record<string, any> } payload The payload to sign
	 * @param { number } [customExpiresIn] Optional custom expiration in seconds
	 * @returns { Promise<string> } The signed token
	 */
	async generate(payload: Record<string, any>, customExpiresIn?: number): Promise<string> {
		const now = Math.floor(Date.now() / 1000);
		const exp = now + (customExpiresIn ?? this.expiresIn);
		
		const fullPayload = {
			...payload,
			iat: now,
			nbf: now,
			exp: exp,
			...(this.iss && { iss: this.iss }),
			...(this.aud && { aud: this.aud }),
		};

		return await sign(fullPayload, this.secret, this.alg);
	}

	/**
	 * @description Generates a pair of tokens: Access and Refresh
	 * @param { Record<string, any> } payload The payload for the access token
	 * @param { number } [accessExpiresIn] Access token expiration
	 * @param { number } [refreshExpiresIn] Refresh token expiration
	 * @returns { Promise<{ accessToken: string; refreshToken: string }> } Token pair
	 */
	async generatePair(
		payload: Record<string, any>,
		accessExpiresIn?: number,
		refreshExpiresIn?: number
	): Promise<{ accessToken: string; refreshToken: string }> {
		const accessToken = await this.generate(payload, accessExpiresIn);
		// Refresh tokens carry only `sub` + a per-mint `jti` nonce. The nonce
		// guarantees each refresh JWT is unique even when two mints land in
		// the same second (login + rotate for the same user), which would
		// otherwise collide on the refresh_tokens.token_hash UNIQUE index.
		const refreshToken = await this.generate(
			{ sub: payload.sub, type: 'refresh', jti: crypto.randomUUID() },
			refreshExpiresIn ?? 60 * 60 * 24 * 30 // 30 days default
		);

		return { accessToken, refreshToken };
	}

	/**
	 * @description Verifies a JWT token
	 * @param { string } token The token to verify
	 * @returns { Promise<T | null> } The decoded payload or null if invalid
	 */
	async verify<T = any>(token: string): Promise<T | null> {
		// Explicit alg pin (#18). Defense against algorithm confusion — the
		// header must literally be HS256; anything else is rejected before we
		// even hit the verifier.
		const header = decodeJwtHeader(token);
		if (!header || header.alg !== PINNED_ALG) return null;

		try {
			const payload = await verify(token, this.secret, this.alg) as Record<string, unknown>;
			// Cross-check iss/aud when the caller supplied them at construction.
			// Tokens minted for a different service, or the wrong client, are
			// rejected even though the signature validates.
			if (this.iss && payload.iss !== this.iss) return null;
			if (this.aud && payload.aud !== this.aud) return null;
			return payload as T;
		} catch (err) {
			return null;
		}
	}

	/**
	 * @description Creates a dynamic instance with a different secret or algorithm
	 * @param { JwtOptions } options JWT configuration
	 * @returns { JwtService } New instance
	 */
	static create(options: JwtOptions): JwtService {
		return new JwtService(options);
	}
}
