import { Hono } from 'hono';
import { AuthController } from './auth.controller';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description GitHub OAuth Callback
 * @method GET
 * ---------------------------------------
 * @param { String } code - Authorization code returned by GitHub
 * @param { String } state - State value returned by GitHub (CSRF token)
*/
app.get('/v1/api/auth/github/callback', (c) => AuthController.githubCallback(c.req.raw, c.env));

/**
 * @description Login with GitHub
 * @method GET
 * ---------------------------------------
*/
app.get('/v1/api/auth/github', (c) => AuthController.github(c.req.raw, c.env));

/**
 * @description Google OAuth Callback
 * @method GET
 * ---------------------------------------
 * @param { String } code - Authorization code returned by Google
 * @param { String } state - State value returned by Google (CSRF token)
*/
app.get('/v1/api/auth/google/callback', (c) => AuthController.googleCallback(c.req.raw, c.env));

/**
 * @description Login with Google
 * @method GET
 * ---------------------------------------
*/
app.get('/v1/api/auth/google', (c) => AuthController.google(c.req.raw, c.env));

/**
 * @description Get Current Authenticated User
 * @method GET
 * ---------------------------------------
 * @header { String } Authorization - Bearer JWT token
*/
app.get('/v1/api/auth/me', (c) => AuthController.me(c.req.raw, c.env));

/**
 * @description Register with Email
 * @method POST
 * ---------------------------------------
 * @param { String } email - The email address
 * @param { String } name - The user name
 * @param { String } password - The password (min 8 characters)
*/
app.post('/v1/api/auth/email/register', (c) => AuthController.emailRegister(c.req.raw, c.env));

/**
 * @description Login with Email
 * @method POST
 * ---------------------------------------
 * @param { String } email - The email address
 * @param { String } password - The password
*/
app.post('/v1/api/auth/email/login', (c) => AuthController.emailLogin(c.req.raw, c.env));

/**
 * @description Verify Email OTP
 * @method POST
 * ---------------------------------------
 * @param { String } email - The email address
 * @param { String } otp - The 6-digit OTP code
*/
app.post('/v1/api/auth/email/verify', (c) => AuthController.emailVerify(c.req.raw, c.env));

/**
 * @description Token Refresh
 * @method POST
 * ---------------------------------------
 * @param { String } refreshToken - The refresh token
*/
app.post('/v1/api/auth/refresh', (c) => AuthController.tokenRefresh(c.req.raw, c.env));

/**
 * @description Logout
 * @method POST
 * ---------------------------------------
*/
app.post('/v1/api/auth/logout', (c) => AuthController.logout(c.req.raw, c.env));

export { app as authRoutes };
