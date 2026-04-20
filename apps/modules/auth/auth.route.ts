import { AuthController } from './auth.controller';

const githubCallbackPattern = new URLPattern({ pathname: '/v1/api/auth/github/callback' });
const githubPattern = new URLPattern({ pathname: '/v1/api/auth/github' });
const googleCallbackPattern = new URLPattern({ pathname: '/v1/api/auth/google/callback' });
const googlePattern = new URLPattern({ pathname: '/v1/api/auth/google' });
const mePattern = new URLPattern({ pathname: '/v1/api/auth/me' });
const emailRegisterPattern = new URLPattern({ pathname: '/v1/api/auth/email/register' });
const emailLoginPattern = new URLPattern({ pathname: '/v1/api/auth/email/login' });
const emailVerifyPattern = new URLPattern({ pathname: '/v1/api/auth/email/verify' });

export async function matchAuthRoutes(request: Request, env: Env): Promise<Response | null> {
	// Callbacks must be tested before their parent paths
	if (githubCallbackPattern.test(request.url)) return AuthController.handle(request, env, 'github/callback');
	if (githubPattern.test(request.url)) return AuthController.handle(request, env, 'github');
	if (googleCallbackPattern.test(request.url)) return AuthController.handle(request, env, 'google/callback');
	if (googlePattern.test(request.url)) return AuthController.handle(request, env, 'google');
	if (mePattern.test(request.url)) return AuthController.handle(request, env, 'me');
	if (emailRegisterPattern.test(request.url)) return AuthController.handle(request, env, 'email/register');
	if (emailLoginPattern.test(request.url)) return AuthController.handle(request, env, 'email/login');
	if (emailVerifyPattern.test(request.url)) return AuthController.handle(request, env, 'email/verify');
	return null;
}
