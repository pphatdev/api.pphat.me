import type { User, JwtPayload, GitHubUser, GitHubEmail, GoogleUser, IAuthRepository } from './auth.interface';

/**
 * JWT helpers
 */

function b64url(data: string | Uint8Array): string {
	const str = typeof data === 'string' ? data : String.fromCharCode(...data);
	return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		[usage],
	);
}

export async function createJwt(
	payload: Omit<JwtPayload, 'iat' | 'exp'>,
	secret: string,
	expiresInSecs = 60 * 60 * 24 * 7,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + expiresInSecs };
	const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body = b64url(JSON.stringify(fullPayload));
	const signingInput = `${header}.${body}`;
	const key = await importHmacKey(secret, 'sign');
	const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
	return `${signingInput}.${b64url(new Uint8Array(sigBuffer))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [header, body, sig] = parts;
	const signingInput = `${header}.${body}`;
	try {
		const key = await importHmacKey(secret, 'verify');
		const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
		const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(signingInput));
		if (!valid) return null;
		const decoded = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
		if (Math.floor(Date.now() / 1000) > decoded.exp) return null;
		return decoded;
	} catch {
		return null;
	}
}

/**
 * OAuth state (CSRF protection)
 */

export async function generateOAuthState(secret: string): Promise<string> {
	const ts = Date.now().toString();
	const key = await importHmacKey(secret, 'sign');
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ts));
	return `${b64url(ts)}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
	const [b64ts, b64sig] = state.split('.');
	if (!b64ts || !b64sig) return false;
	try {
		const ts = atob(b64ts.replace(/-/g, '+').replace(/_/g, '/'));
		if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) return false;
		const key = await importHmacKey(secret, 'verify');
		const sigBytes = Uint8Array.from(atob(b64sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
		return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(ts));
	} catch {
		return false;
	}
}

/**
 * GitHub OAuth
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

function generateOtp(): string {
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1_000_000;
	return String(num).padStart(6, '0');
}

function otpExpiresAt(ttlMinutes = 10): string {
	return new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Password helpers (PBKDF2 via Web Crypto)
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
	constructor(private readonly repo: IAuthRepository) {}

	async handleOAuthCallback(
		provider: 'github' | 'google',
		userInfo: { providerId: string; email: string | null; name: string | null; avatar: string | null },
		jwtSecret: string,
	): Promise<string> {
		const user = await this.repo.findOrCreateUser(provider, userInfo.providerId, {
			email: userInfo.email,
			name: userInfo.name,
			avatar: userInfo.avatar,
		});
		return createJwt({ sub: user.id, provider, email: user.email, name: user.name }, jwtSecret);
	}

	getCurrentUser(id: string): Promise<User | null> {
		return this.repo.findUserById(id);
	}

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

	async loginWithPassword(email: string, password: string, jwtSecret: string): Promise<string> {
		const user = await this.repo.findEmailUser(email);
		if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
		if (!user.email_verified) throw Object.assign(new Error('Email not verified. Complete registration first.'), { status: 403 });
		if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
			throw Object.assign(new Error('Invalid email or password'), { status: 401 });
		}
		return createJwt({ sub: user.id, provider: 'email', email: user.email, name: user.name }, jwtSecret);
	}

	async verifyEmailOtp(email: string, code: string, jwtSecret: string): Promise<string> {
		const valid = await this.repo.verifyAndConsumeOtp(email, code);
		if (!valid) throw Object.assign(new Error('Invalid or expired verification code'), { status: 400 });
		await this.repo.markEmailVerified(email);
		const user = await this.repo.findEmailUser(email);
		if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
		return createJwt({ sub: user.id, provider: 'email', email: user.email, name: user.name }, jwtSecret);
	}
}

