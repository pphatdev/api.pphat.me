import { Hono } from 'hono';
import { AboutMeController } from './about-me.controller';
import { authGuard, requireAdmin, optionalAuth } from '../../middlewares/auth.middleware';
import type { AppEnv } from './about-me.interface';

const app = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// 1. Literal routes (MUST precede parameterized `/:id` to avoid capture)
// ---------------------------------------------------------------------------

/**
 * @description Get active About Me profile for public presentation
 * @method GET
 */
app.get('/v1/api/about-me/active', (c) => AboutMeController.getActive(c.req.raw, c.env));
app.get('/v1/api/about/active', (c) => AboutMeController.getActive(c.req.raw, c.env));

/**
 * @description List About Me profiles
 * Public callers see active profiles; admins can see all or filter by ?status=
 * @method GET
 */
app.get('/v1/api/about-me', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return AboutMeController.list(c.req.raw, c.env, isAdmin);
});
app.get('/v1/api/about', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return AboutMeController.list(c.req.raw, c.env, isAdmin);
});

/**
 * @description Create About Me profile (admin only)
 * @method POST
 */
app.post('/v1/api/about-me', authGuard, requireAdmin, (c) => AboutMeController.create(c.req.raw, c.env));
app.post('/v1/api/about', authGuard, requireAdmin, (c) => AboutMeController.create(c.req.raw, c.env));

// ---------------------------------------------------------------------------
// 2. Parameterized routes by ID
// ---------------------------------------------------------------------------

/**
 * @description Get About Me profile by ID
 * @method GET
 */
app.get('/v1/api/about-me/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return AboutMeController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});
app.get('/v1/api/about/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return AboutMeController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});

/**
 * @description Update About Me profile (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/about-me/:id', authGuard, requireAdmin, (c) => AboutMeController.update(c.req.raw, c.env, c.req.param('id')));
app.put('/v1/api/about/:id', authGuard, requireAdmin, (c) => AboutMeController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/about-me/:id', authGuard, requireAdmin, (c) => AboutMeController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/about/:id', authGuard, requireAdmin, (c) => AboutMeController.update(c.req.raw, c.env, c.req.param('id')));

/**
 * @description Delete About Me profile (admin only)
 * @method DELETE
 */
app.delete('/v1/api/about-me/:id', authGuard, requireAdmin, (c) => AboutMeController.delete(c.req.raw, c.env, c.req.param('id')));
app.delete('/v1/api/about/:id', authGuard, requireAdmin, (c) => AboutMeController.delete(c.req.raw, c.env, c.req.param('id')));

export { app as aboutMeRoutes };
