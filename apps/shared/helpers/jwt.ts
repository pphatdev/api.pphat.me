import { sign, verify, decode } from 'hono/jwt';
import type { SignatureAlgorithm } from 'hono/utils/jwt/jwa';

export interface JwtOptions {
	secret: string;
	alg?: SignatureAlgorithm;
	expiresIn?: number; // seconds
	iss?: string;
	aud?: string;
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
		// Refresh tokens typically only need the 'sub' (user ID)
		const refreshToken = await this.generate(
			{ sub: payload.sub, type: 'refresh' },
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
		try {
			const payload = await verify(token, this.secret, this.alg);
			return payload as T;
		} catch (err) {
			return null;
		}
	}

	/**
	 * @description Decodes token without verification
	 * @param { string } token The token to decode
	 * @returns { T | null } The decoded payload or null
	 */
	decode<T = any>(token: string): T | null {
		try {
			const { payload } = decode(token);
			return payload as T;
		} catch {
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
