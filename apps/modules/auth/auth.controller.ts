import { serialize, parse } from 'hono/utils/cookie';
import { json, isObject } from '../../shared/helpers/json';
import { Res } from '../../shared/helpers/response';
import { AuthRepository } from './auth.repo';
import {
	AuthService,
	generateOAuthState,
	verifyOAuthState,
	exchangeGitHubCode,
	fetchGitHubUser,
	exchangeGoogleCode,
	fetchGoogleUser,
	verifyJwt,
	type OAuthProvider,
} from './auth.service';
import { sendOtpEmail } from './email.service';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_COOKIE_PATH = '/v1/api/auth';
const OAUTH_STATE_TTL_SECONDS = 600;

function isSecureAppUrl(env: Env): boolean {
	return typeof env.APP_URL === 'string' && env.APP_URL.startsWith('https:');
}

function buildStateCookie(env: Env, value: string): string {
	return serialize(OAUTH_STATE_COOKIE, value, {
		httpOnly: true,
		secure: isSecureAppUrl(env),
		sameSite: 'Lax',
		path: OAUTH_COOKIE_PATH,
		maxAge: OAUTH_STATE_TTL_SECONDS,
	});
}

function clearStateCookie(env: Env): string {
	return serialize(OAUTH_STATE_COOKIE, '', {
		httpOnly: true,
		secure: isSecureAppUrl(env),
		sameSite: 'Lax',
		path: OAUTH_COOKIE_PATH,
		maxAge: 0,
	});
}

function readStateCookie(request: Request): string | null {
	const header = request.headers.get('Cookie');
	if (!header) return null;
	const jar = parse(header, OAUTH_STATE_COOKIE);
	return jar[OAUTH_STATE_COOKIE] ?? null;
}

export class AuthController {

	/**
	 * @description Redirect to GitHub OAuth
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Redirect response
	 */
	static async github(request: Request, env: Env): Promise<Response> {
		const { state, cookieValue, codeChallenge } = await generateOAuthState(env.JWT_SECRET, 'github');
		const params = new URLSearchParams({
			client_id: env.GITHUB_CLIENT_ID,
			redirect_uri: `${env.APP_URL}/v1/api/auth/github/callback`,
			scope: 'read:user user:email',
			state,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
		});
		return new Response(null, {
			status: 302,
			headers: {
				Location: `https://github.com/login/oauth/authorize?${params}`,
				'Set-Cookie': buildStateCookie(env, cookieValue),
			},
		});
	}

	/**
	 * @description Handle GitHub OAuth callback
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Auth tokens
	 */
	static async githubCallback(request: Request, env: Env): Promise<Response> {
		return handleOAuthCallback(request, env, 'github', exchangeGitHubCode, fetchGitHubUser);
	}

	/**
	 * @description Redirect to Google OAuth
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Redirect response
	 */
	static async google(request: Request, env: Env): Promise<Response> {
		const { state, cookieValue, codeChallenge } = await generateOAuthState(env.JWT_SECRET, 'google');
		const params = new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			redirect_uri: `${env.APP_URL}/v1/api/auth/google/callback`,
			response_type: 'code',
			scope: 'openid email profile',
			state,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
		});
		return new Response(null, {
			status: 302,
			headers: {
				Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
				'Set-Cookie': buildStateCookie(env, cookieValue),
			},
		});
	}

	/**
	 * @description Handle Google OAuth callback
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Auth tokens
	 */
	static async googleCallback(request: Request, env: Env): Promise<Response> {
		return handleOAuthCallback(request, env, 'google', exchangeGoogleCode, fetchGoogleUser);
	}

	/**
	 * @description Get current authenticated user details
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } User details
	 */
	static async me(request: Request, env: Env): Promise<Response> {
		const repo = new AuthRepository(env.DB);
		const authHeader = request.headers.get('Authorization');
		if (!authHeader?.startsWith('Bearer ')) return Res.unauthorized();
		const rawToken = authHeader.slice(7);
		const payload = await verifyJwt(rawToken, env.JWT_SECRET);
		if (!payload) return Res.unauthorized('Invalid or expired token');
		const user = await new AuthService(repo).getCurrentUser(payload.sub);
		if (!user) return Res.notFound('User not found');
		return Res.ok(user);
	}

	/**
	 * @description Register a new user with email/password
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Success message
	 */
	static async emailRegister(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const error = validateRegisterBody(body);
		if (error) return error;

		const { email, name, password } = body as any;
		try {
			const repo = new AuthRepository(env.DB);
			const { otp } = await new AuthService(repo).registerEmailUser(email, name, password);
			await sendOtpEmailSafely(email, otp, env);
			return Res.created({ message: 'Verification code sent to your email' });
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Login with email and password
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Auth tokens
	 */
	static async emailLogin(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { email, password } = body as any;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!password || typeof password !== 'string') return Res.badRequest('password is required');

		try {
			const repo = new AuthRepository(env.DB);
			const tokens = await new AuthService(repo).loginWithPassword(email, password, env.JWT_SECRET);
			return Res.ok(tokens);
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Verify email OTP and activate account
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Auth tokens
	 */
	static async emailVerify(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { email, otp } = body as any;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!otp || typeof otp !== 'string') return Res.badRequest('otp is required');

		try {
			const repo = new AuthRepository(env.DB);
			const tokens = await new AuthService(repo).verifyEmailOtp(email, otp, env.JWT_SECRET);
			return Res.ok(tokens);
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Refresh auth tokens
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } New auth tokens
	 */
	static async tokenRefresh(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { refreshToken } = body as any;
		if (!refreshToken || typeof refreshToken !== 'string') return Res.badRequest('refreshToken is required');

		try {
			const repo = new AuthRepository(env.DB);
			const tokens = await new AuthService(repo).refresh(refreshToken, env.JWT_SECRET);
			return Res.ok(tokens);
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Issue a new SSO API key for the authenticated user
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } userId The authenticated user's ID (from authGuard)
	 * @returns { Promise<Response> } Newly created key metadata + one-time plaintext key
	 */
	static async createApiKey(request: Request, env: Env, userId: string): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { name, expiresInDays } = body as any;
		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return Res.unprocessable('name is required');
		}
		if (expiresInDays !== undefined && expiresInDays !== null && (typeof expiresInDays !== 'number' || expiresInDays <= 0)) {
			return Res.unprocessable('expiresInDays must be a positive number');
		}

		try {
			const repo = new AuthRepository(env.DB);
			const { record, plaintext } = await new AuthService(repo).createApiKey(
				userId,
				name.trim(),
				typeof expiresInDays === 'number' ? expiresInDays : null,
			);
			return Res.created({
				id: record.id,
				name: record.name,
				prefix: record.prefix,
				expires_at: record.expires_at,
				created_at: record.created_at,
				key: plaintext,
				warning: 'Store this key securely. It will not be shown again.',
			});
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description List SSO API keys for the authenticated user (metadata only)
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } userId The authenticated user's ID (from authGuard)
	 * @returns { Promise<Response> } Array of key metadata
	 */
	static async listApiKeys(request: Request, env: Env, userId: string): Promise<Response> {
		try {
			const repo = new AuthRepository(env.DB);
			const keys = await new AuthService(repo).listApiKeys(userId);
			return Res.ok({ keys });
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Revoke an SSO API key owned by the authenticated user
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } userId The authenticated user's ID (from authGuard)
	 * @param { string } keyId Key ID to revoke
	 * @returns { Promise<Response> } Success message or 404
	 */
	static async revokeApiKey(request: Request, env: Env, userId: string, keyId: string): Promise<Response> {
		try {
			const repo = new AuthRepository(env.DB);
			const revoked = await new AuthService(repo).revokeApiKey(keyId, userId);
			if (!revoked) return Res.notFound('API key not found');
			return Res.ok({ message: 'API key revoked' });
		} catch (err) {
			return handleAuthError(err);
		}
	}

	/**
	 * @description Logout user and revoke refresh token
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Success message
	 */
	static async logout(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		const refreshToken = isObject(body) ? (body as any).refreshToken : null;

		if (refreshToken && typeof refreshToken === 'string') {
			try {
				const repo = new AuthRepository(env.DB);
				await new AuthService(repo).logout(refreshToken);
			} catch (err) {
				// Silently fail on logout if token is already gone or invalid
			}
		}
		return Res.ok({ message: 'Logged out successfully' });
	}
}

/**
 * @description Validates the registration request body
 * @param { any } body The request body
 * @returns { Response | null } Error response or null if valid
 */
function validateRegisterBody(body: any): Response | null {
	const { email, name, password } = body;
	if (!email || typeof email !== 'string') return Res.unprocessable('email is required');
	if (!name || typeof name !== 'string') return Res.unprocessable('name is required');
	if (!password || typeof password !== 'string' || password.length < 8) {
		return Res.unprocessable('password must be at least 8 characters');
	}
	return null;
}

/**
 * Generic OAuth callback handler to reduce duplication
 */
/**
 * @description Generic OAuth callback handler to reduce duplication
 * @param { Request } request The incoming request
 * @param { Env } env Environment bindings
 * @param { 'github' | 'google' } provider OAuth provider
 * @param { Function } exchangeCode Function to exchange code for token
 * @param { Function } fetchUser Function to fetch user info
 * @returns { Promise<Response> } Auth tokens
 */
async function handleOAuthCallback(
	request: Request,
	env: Env,
	provider: OAuthProvider,
	exchangeCode: (code: string, clientId: string, clientSecret: string, redirectUri: string, codeVerifier?: string) => Promise<string>,
	fetchUser: (accessToken: string) => Promise<{ providerId: string; email: string | null; name: string | null; avatar: string | null }>,
): Promise<Response> {
	const clearCookie = clearStateCookie(env);
	const withCleared = (res: Response): Response => {
		res.headers.append('Set-Cookie', clearCookie);
		return res;
	};

	const url = new URL(request.url);
	const oauthError = url.searchParams.get('error');
	if (oauthError) return withCleared(json({ error: oauthError, description: url.searchParams.get('error_description') }, 400));

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) return withCleared(Res.badRequest('Missing code or state'));

	const cookieVal = readStateCookie(request);
	const verified = await verifyOAuthState(state, cookieVal, env.JWT_SECRET, provider);
	if (!verified) return withCleared(Res.badRequest('Invalid or expired state'));

	try {
		const redirectUri = `${env.APP_URL}/v1/api/auth/${provider}/callback`;
		const clientId = provider === 'github' ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID;
		const clientSecret = provider === 'github' ? env.GITHUB_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;

		const accessToken = await exchangeCode(code, clientId, clientSecret, redirectUri, verified.codeVerifier);
		const userInfo = await fetchUser(accessToken);

		const repo = new AuthRepository(env.DB);
		const tokens = await new AuthService(repo).handleOAuthCallback(provider, userInfo, env.JWT_SECRET);
		return withCleared(Res.ok(tokens));
	} catch (err) {
		return withCleared(json({ error: err instanceof Error ? err.message : `${provider} authentication failed` }, 502));
	}
}

/**
 * Handles authentication errors uniformly
 */
/**
 * @description Handles authentication errors uniformly
 * @param { unknown } err The error caught
 * @returns { Response } Error response
 */
function handleAuthError(err: unknown): Response {
	const e = err as Error & { status?: number };
	return json({ error: e.message }, e.status ?? 500);
}

/**
 * Sends OTP email with fallback
 */
/**
 * @description Sends OTP email with fallback
 * @param { string } email Recipient email
 * @param { string } otp The code to send
 * @param { Env } env Environment bindings
 * @returns { Promise<void> }
 */
async function sendOtpEmailSafely(email: string, otp: string, env: Env): Promise<void> {
	try {
		await sendOtpEmail(email, otp, {
			host: env.SMTP_HOST,
			port: Number(env.SMTP_PORT),
			user: env.SMTP_USER,
			pass: env.SMTP_PASS,
			from: env.SMTP_FROM,
		});
	} catch (error) {
		console.error('[SEND_OTP_ERROR]', error);
	}
}
