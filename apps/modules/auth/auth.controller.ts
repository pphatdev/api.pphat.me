import { json } from '../../shared/helpers/json';
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
		const repo = new AuthRepository(env.DB);
		const url = new URL(request.url);
		const oauthError = url.searchParams.get('error');
		if (oauthError) return json({ error: oauthError, description: url.searchParams.get('error_description') }, 400);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		if (!code || !state) return Res.badRequest('Missing code or state');
		if (!(await verifyOAuthState(state, env.JWT_SECRET))) return Res.badRequest('Invalid or expired state');
		try {
			const ghToken = await exchangeGitHubCode(
				code,
				env.GITHUB_CLIENT_ID,
				env.GITHUB_CLIENT_SECRET,
				`${env.APP_URL}/v1/api/auth/github/callback`,
			);
			const userInfo = await fetchGitHubUser(ghToken);
			const token = await new AuthService(repo).handleOAuthCallback('github', userInfo, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			return json({ error: err instanceof Error ? err.message : 'GitHub authentication failed' }, 502);
		}
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
		const repo = new AuthRepository(env.DB);
		const url = new URL(request.url);
		const oauthError = url.searchParams.get('error');
		if (oauthError) return json({ error: oauthError, description: url.searchParams.get('error_description') }, 400);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		if (!code || !state) return Res.badRequest('Missing code or state');
		if (!(await verifyOAuthState(state, env.JWT_SECRET))) return Res.badRequest('Invalid or expired state');
		try {
			const googleToken = await exchangeGoogleCode(
				code,
				env.GOOGLE_CLIENT_ID,
				env.GOOGLE_CLIENT_SECRET,
				`${env.APP_URL}/v1/api/auth/google/callback`,
			);
			const userInfo = await fetchGoogleUser(googleToken);
			const token = await new AuthService(repo).handleOAuthCallback('google', userInfo, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			return json({ error: err instanceof Error ? err.message : 'Google authentication failed' }, 502);
		}
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
		const repo = new AuthRepository(env.DB);
		let body: { email?: string; name?: string; password?: string };
		try {
			body = await request.json() as { email?: string; name?: string; password?: string };
		} catch {
			return Res.badRequest('Invalid JSON body');
		}
		const { email, name, password } = body;
		if (!email || typeof email !== 'string') return Res.unprocessable('email is required');
		if (!name || typeof name !== 'string') return Res.unprocessable('name is required');
		if (!password || typeof password !== 'string' || password.length < 8) return Res.unprocessable('password must be at least 8 characters');
		try {
			const { otp } = await new AuthService(repo).registerEmailUser(email, name, password);
			try {
				await sendOtpEmail(email, otp, {
					host: env.SMTP_HOST,
					port: Number(env.SMTP_PORT),
					user: env.SMTP_USER,
					pass: env.SMTP_PASS,
					from: env.SMTP_FROM,
				});
			} catch {
				// Email delivery is best-effort; the OTP is stored and can be resent.
			}
			return Res.created({ message: 'Verification code sent to your email' });
		} catch (err) {
			const e = err as Error & { status?: number };
			return json({ error: e.message }, e.status ?? 500);
		}
	}

	static async emailLogin(request: Request, env: Env): Promise<Response> {
		const repo = new AuthRepository(env.DB);
		let body: { email?: string; password?: string };
		try {
			body = await request.json() as { email?: string; password?: string };
		} catch {
			return Res.badRequest('Invalid JSON body');
		}
		const { email, password } = body;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!password || typeof password !== 'string') return Res.badRequest('password is required');
		try {
			const token = await new AuthService(repo).loginWithPassword(email, password, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			const e = err as Error & { status?: number };
			return json({ error: e.message }, e.status ?? 500);
		}
	}

	static async emailVerify(request: Request, env: Env): Promise<Response> {
		const repo = new AuthRepository(env.DB);
		let body: { email?: string; otp?: string };
		try {
			body = await request.json() as { email?: string; otp?: string };
		} catch {
			return Res.badRequest('Invalid JSON body');
		}
		const { email, otp } = body;
		if (!email || typeof email !== 'string') return Res.badRequest('email is required');
		if (!otp || typeof otp !== 'string') return Res.badRequest('otp is required');
		try {
			const token = await new AuthService(repo).verifyEmailOtp(email, otp, env.JWT_SECRET);
			return Res.ok({ token });
		} catch (err) {
			const e = err as Error & { status?: number };
			return json({ error: e.message }, e.status ?? 500);
		}
	}
}
