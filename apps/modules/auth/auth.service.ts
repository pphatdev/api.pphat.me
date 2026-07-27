import type { User, JwtPayload, GitHubUser, GitHubEmail, GoogleUser, IAuthRepository, ApiKeyRecord } from './auth.interface';
import { JwtService } from '../../shared/helpers/jwt';

/**
 * API key configuration
 */
const API_KEY_PREFIX = 'ppk_';
const API_KEY_ENTROPY_BYTES = 24; // 24 bytes → 48 hex chars → full token "ppk_<48 hex>"
const API_KEY_LOOKUP_PREFIX_LEN = API_KEY_PREFIX.length + 8; // stored prefix for humans

/**
 * @description Hash an API key using SHA-256
 * @param { string } key Plaintext key
 * @returns { Promise<string> } Hex-encoded hash
 */
export async function hashApiKey(key: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description Generate a new random API key value
 * @returns { { plaintext: string; prefix: string } } The key and its display prefix
 */
export function generateApiKeyValue(): { plaintext: string; prefix: string } {
	const bytes = crypto.getRandomValues(new Uint8Array(API_KEY_ENTROPY_BYTES));
	const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
	const plaintext = `${API_KEY_PREFIX}${hex}`;
	return { plaintext, prefix: plaintext.slice(0, API_KEY_LOOKUP_PREFIX_LEN) };
}

/**
 * JWT helpers (Delegated to JwtService)
 */

/**
 * @description Internal: generates access and refresh tokens
 * @param { Omit<JwtPayload, 'iat' | 'exp'> } payload JWT payload
 * @param { IAuthRepository } repo Auth repository
 * @param { string } secret JWT secret
 * @param { number } [accessTTL=3600] Access token TTL in seconds
 * @param { number } [refreshTTL=2592000] Refresh token TTL in seconds
 * @returns { Promise<{ accessToken: string; refreshToken: string }> } Token pair
 */
async function generateTokens(
	payload: Omit<JwtPayload, 'iat' | 'exp'>,
	repo: IAuthRepository,
	secret: string,
	accessTTL = 60 * 60, // 1 hour
	refreshTTL = 60 * 60 * 24 * 30, // 30 days
): Promise<{ accessToken: string; refreshToken: string }> {
	const jwt = JwtService.create({ secret });
	const { accessToken, refreshToken } = await jwt.generatePair(payload, accessTTL, refreshTTL);

	const expiresAt = new Date(Date.now() + refreshTTL * 1000).toISOString();
	await repo.saveRefreshToken(payload.sub, refreshToken, expiresAt);

	return { accessToken, refreshToken };
}

/**
 * @description Verify a JWT token
 * @param { string } token The token to verify
 * @param { string } secret JWT secret
 * @returns { Promise<JwtPayload | null> } Decoded payload or null
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
	return JwtService.create({ secret }).verify<JwtPayload>(token);
}

/**
 * @description Create a new JWT token
 * @param { Record<string, any> } payload Data to encode
 * @param { string } secret JWT secret
 * @param { number } [expiresIn] TTL in seconds
 * @returns { Promise<string> } Encoded token
 */
export async function createJwt(payload: Record<string, any>, secret: string, expiresIn?: number): Promise<string> {
	return JwtService.create({ secret }).generate(payload, expiresIn);
}

/**
 * OAuth state (CSRF protection)
 */
/**
 * @description Generate OAuth state for CSRF protection
 * @param { string } secret JWT secret
 * @returns { Promise<string> } Encoded state
 */
export async function generateOAuthState(secret: string): Promise<string> {
	return JwtService.create({ secret, expiresIn: 600 }).generate({ ts: Date.now() });
}

/**
 * @description Verify OAuth state
 * @param { string } state The state to verify
 * @param { string } secret JWT secret
 * @returns { Promise<boolean> } True if valid
 */
export async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
	const payload = await JwtService.create({ secret }).verify(state);
	return !!payload;
}

/**
 * GitHub OAuth
 */
/**
 * @description Exchange GitHub auth code for access token
 * @param { string } code Auth code
 * @param { string } clientId GitHub client ID
 * @param { string } clientSecret GitHub client secret
 * @param { string } redirectUri GitHub redirect URI
 * @returns { Promise<string> } Access token
 */
export async function exchangeGitHubCode(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
): Promise<string> {
	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
	});
	const data = (await res.json()) as { access_token?: string; error?: string };
	if (!data.access_token) throw new Error(data.error ?? 'GitHub token exchange failed');
	return data.access_token;
}

/**
 * @description Fetch user info from GitHub
 * @param { string } accessToken GitHub access token
 * @returns { Promise<{ providerId: string; email: string | null; name: string | null; avatar: string | null }> } User profile
 */
export async function fetchGitHubUser(
	accessToken: string,
): Promise<{ providerId: string; email: string | null; name: string | null; avatar: string | null }> {
	const [userRes, emailsRes] = await Promise.all([
		fetch('https://api.github.com/user', {
			headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'api-pphat-me' },
		}),
		fetch('https://api.github.com/user/emails', {
			headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'api-pphat-me' },
		}),
	]);
	const user = (await userRes.json()) as GitHubUser;
	const emails = (await emailsRes.json()) as GitHubEmail[];
	const primaryEmail = emails.find((e) => e.primary && e.verified)?.email ?? user.email ?? null;
	return {
		providerId: user.id.toString(),
		email: primaryEmail,
		name: user.name ?? user.login,
		avatar: user.avatar_url,
	};
}

/**
 * Google OAuth
 */
/**
 * @description Exchange Google auth code for access token
 * @param { string } code Auth code
 * @param { string } clientId Google client ID
 * @param { string } clientSecret Google client secret
 * @param { string } redirectUri Google redirect URI
 * @returns { Promise<string> } Access token
 */
export async function exchangeGoogleCode(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
): Promise<string> {
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
		}),
	});
	const data = (await res.json()) as { access_token?: string; error?: string };
	if (!data.access_token) throw new Error(data.error ?? 'Google token exchange failed');
	return data.access_token;
}

/**
 * @description Fetch user info from Google
 * @param { string } accessToken Google access token
 * @returns { Promise<{ providerId: string; email: string | null; name: string | null; avatar: string | null }> } User profile
 */
export async function fetchGoogleUser(
	accessToken: string,
): Promise<{ providerId: string; email: string | null; name: string | null; avatar: string | null }> {
	const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	const user = (await res.json()) as GoogleUser;
	return {
		providerId: user.id,
		email: user.email ?? null,
		name: user.name ?? null,
		avatar: user.picture ?? null,
	};
}

/**
 * Email OTP helpers
 */
/**
 * @description Generate a 6-digit OTP
 * @returns { string } The OTP
 */
function generateOtp(): string {
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1_000_000;
	return String(num).padStart(6, '0');
}

/**
 * @description Calculate OTP expiry timestamp
 * @param { number } [ttlMinutes=10] TTL in minutes
 * @returns { string } ISO-like timestamp
 */
function otpExpiresAt(ttlMinutes = 10): string {
	return new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Password helpers (PBKDF2 via Web Crypto)
 */
/**
 * @description Hash a password using PBKDF2
 * @param { string } password Raw password
 * @returns { Promise<string> } Salted hash string
 */
async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
		keyMaterial,
		256,
	);
	const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
	const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${saltHex}:${hashHex}`;
}

/**
 * @description Verify a password against a stored hash
 * @param { string } password Raw password
 * @param { string } stored Stored hash string
 * @returns { Promise<boolean> } True if matches
 */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(':');
	if (!saltHex || !hashHex) return false;
	const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
		keyMaterial,
		256,
	);
	const candidate = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
	return candidate === hashHex;
}

/**
 * Use cases
 */
export class AuthService {
	constructor(private readonly repo: IAuthRepository) { }

	/**
	 * @description Handle OAuth callback data and generate tokens
	 * @param { 'github' | 'google' } provider OAuth provider
	 * @param { object } userInfo User profile from provider
	 * @param { string } jwtSecret JWT secret
	 * @returns { Promise<{ accessToken: string; refreshToken: string }> } Token pair
	 */
	async handleOAuthCallback(
		provider: 'github' | 'google',
		userInfo: { providerId: string; email: string | null; name: string | null; avatar: string | null },
		jwtSecret: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const user = await this.repo.findOrCreateUser(provider, userInfo.providerId, {
			email: userInfo.email,
			name: userInfo.name,
			avatar: userInfo.avatar,
		});
		return generateTokens(
			{ sub: user.id, provider, email: user.email, name: user.name, role: user.role ?? 'user' },
			this.repo,
			jwtSecret
		);
	}

	/**
	 * @description Get user details by ID
	 * @param { string } id User ID
	 * @returns { Promise<User | null> } User details or null
	 */
	getCurrentUser(id: string): Promise<User | null> {
		return this.repo.findUserById(id);
	}

	/**
	 * @description Register a new email-based user
	 * @param { string } email User email
	 * @param { string } name User name
	 * @param { string } password Raw password
	 * @returns { Promise<{ otp: string }> } Verification OTP
	 */
	async registerEmailUser(email: string, name: string, password: string): Promise<{ otp: string }> {
		const existing = await this.repo.findEmailUser(email);
		if (existing) {
			if (existing.email_verified) throw Object.assign(new Error('Email already registered'), { status: 409 });
			// Unverified — resend a fresh OTP
			const otp = generateOtp();
			await this.repo.createOtp(email, otp, otpExpiresAt());
			return { otp };
		}
		const passwordHash = await hashPassword(password);
		await this.repo.createEmailUser(email, name, passwordHash);
		const otp = generateOtp();
		await this.repo.createOtp(email, otp, otpExpiresAt());
		return { otp };
	}

	/**
	 * @description Authenticate user with email and password
	 * @param { string } email User email
	 * @param { string } password Raw password
	 * @param { string } jwtSecret JWT secret
	 * @returns { Promise<{ accessToken: string; refreshToken: string }> } Token pair
	 */
	async loginWithPassword(email: string, password: string, jwtSecret: string): Promise<{ accessToken: string; refreshToken: string }> {
		const user = await this.repo.findEmailUser(email);
		if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
		if (!user.email_verified) throw Object.assign(new Error('Email not verified. Complete registration first.'), { status: 403 });
		if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
			throw Object.assign(new Error('Invalid email or password'), { status: 401 });
		}
		return generateTokens(
			{ sub: user.id, provider: 'email', email: user.email, name: user.name, role: user.role ?? 'user' },
			this.repo,
			jwtSecret
		);
	}

	/**
	 * @description Verify email OTP and generate tokens
	 * @param { string } email User email
	 * @param { string } code The OTP
	 * @param { string } jwtSecret JWT secret
	 * @returns { Promise<{ accessToken: string; refreshToken: string }> } Token pair
	 */
	async verifyEmailOtp(email: string, code: string, jwtSecret: string): Promise<{ accessToken: string; refreshToken: string }> {
		const valid = await this.repo.verifyAndConsumeOtp(email, code);
		if (!valid) throw Object.assign(new Error('Invalid or expired verification code'), { status: 400 });
		await this.repo.markEmailVerified(email);
		const user = await this.repo.findEmailUser(email);
		if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
		return generateTokens(
			{ sub: user.id, provider: 'email', email: user.email, name: user.name, role: user.role ?? 'user' },
			this.repo,
			jwtSecret
		);
	}

	/**
	 * @description Refresh auth tokens using a refresh token
	 * @param { string } refreshToken The refresh token
	 * @param { string } jwtSecret JWT secret
	 * @returns { Promise<{ accessToken: string; refreshToken: string }> } New token pair
	 */
	async refresh(refreshToken: string, jwtSecret: string): Promise<{ accessToken: string; refreshToken: string }> {
		const payload = await verifyJwt(refreshToken, jwtSecret);
		if (!payload || (payload as any).type !== 'refresh') {
			throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
		}

		const stored = await this.repo.findRefreshToken(refreshToken);
		if (!stored) throw Object.assign(new Error('Refresh token revoked or not found'), { status: 401 });

		// Optional: Rotate refresh token (delete old, issue new)
		await this.repo.deleteRefreshToken(refreshToken);

		const user = await this.repo.findUserById(stored.user_id);
		if (!user) throw Object.assign(new Error('User not found'), { status: 401 });

		return generateTokens(
			{ sub: user.id, provider: user.provider, email: user.email, name: user.name, role: user.role ?? 'user' },
			this.repo,
			jwtSecret
		);
	}

	/**
	 * @description Revoke a refresh token (logout)
	 * @param { string } refreshToken The refresh token to revoke
	 * @returns { Promise<void> }
	 */
	async logout(refreshToken: string): Promise<void> {
		await this.repo.deleteRefreshToken(refreshToken);
	}

	/**
	 * @description Issue a new API key for a user (SSO-style programmatic access)
	 * @param { string } userId Owning user ID
	 * @param { string } name Human-readable label
	 * @param { number | null } [expiresInDays] Optional TTL in days
	 * @returns { Promise<{ record: ApiKeyRecord; plaintext: string }> } The record and the one-time plaintext key
	 */
	async createApiKey(
		userId: string,
		name: string,
		expiresInDays: number | null = null,
	): Promise<{ record: ApiKeyRecord; plaintext: string }> {
		const { plaintext, prefix } = generateApiKeyValue();
		const keyHash = await hashApiKey(plaintext);
		const id = crypto.randomUUID();
		const expiresAt = expiresInDays && expiresInDays > 0
			? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
			: null;
		const record = await this.repo.createApiKey(id, userId, name, prefix, keyHash, expiresAt);
		return { record, plaintext };
	}

	/**
	 * @description List a user's API keys (metadata only — no plaintext)
	 * @param { string } userId Owning user ID
	 * @returns { Promise<ApiKeyRecord[]> } The user's keys
	 */
	async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
		return this.repo.listApiKeysByUser(userId);
	}

	/**
	 * @description Revoke an API key owned by the user
	 * @param { string } id Key ID
	 * @param { string } userId Owning user ID
	 * @returns { Promise<boolean> } True if a key was revoked
	 */
	async revokeApiKey(id: string, userId: string): Promise<boolean> {
		return this.repo.revokeApiKey(id, userId);
	}

	/**
	 * @description Verify a presented API key and return the owning user
	 * @param { string } plaintext The raw API key string
	 * @returns { Promise<User | null> } Owning user or null if invalid/revoked/expired
	 */
	async verifyApiKey(plaintext: string): Promise<User | null> {
		if (!plaintext || !plaintext.startsWith(API_KEY_PREFIX)) return null;
		const keyHash = await hashApiKey(plaintext);
		const lookup = await this.repo.findApiKeyByHash(keyHash);
		if (!lookup) return null;
		if (lookup.revoked_at) return null;
		if (lookup.expires_at && new Date(lookup.expires_at).getTime() < Date.now()) return null;
		const user = await this.repo.findUserById(lookup.user_id);
		if (!user) return null;
		await this.repo.touchApiKeyLastUsed(lookup.id);
		return user;
	}
}

