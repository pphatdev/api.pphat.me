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
	 * Generates a pair of tokens: Access and Refresh
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

	async verify<T = any>(token: string): Promise<T | null> {
		try {
			const payload = await verify(token, this.secret, this.alg);
			return payload as T;
		} catch (err) {
			return null;
		}
	}

	/**
	 * Decodes token without verification
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
	 * Creates a dynamic instance with a different secret or algorithm if needed
	 */
	static create(options: JwtOptions): JwtService {
		return new JwtService(options);
	}
}
