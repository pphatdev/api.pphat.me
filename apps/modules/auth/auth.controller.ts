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
} from './auth.service';
import { sendOtpEmail } from './email.service';

export class AuthController {

	static async github(request: Request, env: Env): Promise<Response> {
		const state = await generateOAuthState(env.JWT_SECRET);
		const params = new URLSearchParams({
			client_id: env.GITHUB_CLIENT_ID,
			redirect_uri: `${env.APP_URL}/v1/api/auth/github/callback`,
			scope: 'read:user user:email',
			state,
		});
		return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
	}

	static async githubCallback(request: Request, env: Env): Promise<Response> {
		return handleOAuthCallback(request, env, 'github', exchangeGitHubCode, fetchGitHubUser);
	}

	static async google(request: Request, env: Env): Promise<Response> {
		const state = await generateOAuthState(env.JWT_SECRET);
		const params = new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			redirect_uri: `${env.APP_URL}/v1/api/auth/google/callback`,
			response_type: 'code',
			scope: 'openid email profile',
			state,
		});
		return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
	}

	static async googleCallback(request: Request, env: Env): Promise<Response> {
		return handleOAuthCallback(request, env, 'google', exchangeGoogleCode, fetchGoogleUser);
	}

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

	static async emailLogin(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { email, password } = body as any;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!password || typeof password !== 'string') return Res.badRequest('password is required');

		try {
			const repo = new AuthRepository(env.DB);
			const token = await new AuthService(repo).loginWithPassword(email, password, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			return handleAuthError(err);
		}
	}

	static async emailVerify(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

		const { email, otp } = body as any;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!otp || typeof otp !== 'string') return Res.badRequest('otp is required');

		try {
			const repo = new AuthRepository(env.DB);
			const token = await new AuthService(repo).verifyEmailOtp(email, otp, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			return handleAuthError(err);
		}
	}
}

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
async function handleOAuthCallback(
	request: Request,
	env: Env,
	provider: 'github' | 'google',
	exchangeCode: Function,
	fetchUser: Function,
): Promise<Response> {
	const url = new URL(request.url);
	const oauthError = url.searchParams.get('error');
	if (oauthError) return json({ error: oauthError, description: url.searchParams.get('error_description') }, 400);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) return Res.badRequest('Missing code or state');
	if (!(await verifyOAuthState(state, env.JWT_SECRET))) return Res.badRequest('Invalid or expired state');

	try {
		const redirectUri = `${env.APP_URL}/v1/api/auth/${provider}/callback`;
		const clientId = provider === 'github' ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID;
		const clientSecret = provider === 'github' ? env.GITHUB_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;

		const accessToken = await exchangeCode(code, clientId, clientSecret, redirectUri);
		const userInfo = await fetchUser(accessToken);

		const repo = new AuthRepository(env.DB);
		const token = await new AuthService(repo).handleOAuthCallback(provider, userInfo, env.JWT_SECRET);
		return Res.ok({ token });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : `${provider} authentication failed` }, 502);
	}
}

/**
 * Handles authentication errors uniformly
 */
function handleAuthError(err: unknown): Response {
	const e = err as Error & { status?: number };
	return json({ error: e.message }, e.status ?? 500);
}

/**
 * Sends OTP email with fallback
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
