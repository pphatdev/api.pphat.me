import { Hono } from 'hono';
import { AuthController } from './auth.controller';

const app = new Hono<{ Bindings: Env }>();

// Callbacks registered before their parent paths so Hono matches them first
app.get('/v1/api/auth/github/callback', (c) => AuthController.handle(c.req.raw, c.env, 'github/callback'));
app.get('/v1/api/auth/github',          (c) => AuthController.handle(c.req.raw, c.env, 'github'));
app.get('/v1/api/auth/google/callback', (c) => AuthController.handle(c.req.raw, c.env, 'google/callback'));
app.get('/v1/api/auth/google',          (c) => AuthController.handle(c.req.raw, c.env, 'google'));
app.get('/v1/api/auth/me',              (c) => AuthController.handle(c.req.raw, c.env, 'me'));

app.post('/v1/api/auth/email/register', (c) => AuthController.handle(c.req.raw, c.env, 'email/register'));
app.post('/v1/api/auth/email/login',    (c) => AuthController.handle(c.req.raw, c.env, 'email/login'));
app.post('/v1/api/auth/email/verify',   (c) => AuthController.handle(c.req.raw, c.env, 'email/verify'));

export { app as authRoutes };
