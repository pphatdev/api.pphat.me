import { Hono } from 'hono';
import { ServicesController } from './services.controller';
import { authGuard, requireAdmin, optionalAuth } from '../../middlewares/auth.middleware';
import type { AppEnv } from './services.interface';

const app = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// 1. Literal routes (MUST precede `/:id` to avoid path capture)
// ---------------------------------------------------------------------------

/**
 * @description Get Services Overview (Section Header + Active Services)
 * @method GET
 */
app.get('/v1/api/services/overview', (c) => ServicesController.getOverview(c.req.raw, c.env));
app.get('/v1/api/service/overview', (c) => ServicesController.getOverview(c.req.raw, c.env));

/**
 * @description Get active public services
 * @method GET
 */
app.get('/v1/api/services/public', (c) => ServicesController.list(c.req.raw, c.env, false));
app.get('/v1/api/service/public', (c) => ServicesController.list(c.req.raw, c.env, false));

/**
 * @description Get Service Section Header
 * @method GET
 */
app.get('/v1/api/services/section', (c) => ServicesController.getSection(c.req.raw, c.env));
app.get('/v1/api/service/section', (c) => ServicesController.getSection(c.req.raw, c.env));

/**
 * @description Update Service Section Header (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/services/section', authGuard, requireAdmin, (c) => ServicesController.updateSection(c.req.raw, c.env));
app.put('/v1/api/service/section', authGuard, requireAdmin, (c) => ServicesController.updateSection(c.req.raw, c.env));
app.patch('/v1/api/services/section', authGuard, requireAdmin, (c) => ServicesController.updateSection(c.req.raw, c.env));
app.patch('/v1/api/service/section', authGuard, requireAdmin, (c) => ServicesController.updateSection(c.req.raw, c.env));

/**
 * @description Get Service Order Sequence
 * @method GET
 */
app.get('/v1/api/services/order-sequence', authGuard, (c) => ServicesController.getOrderSequence(c.req.raw, c.env));
app.get('/v1/api/service/order-sequence', authGuard, (c) => ServicesController.getOrderSequence(c.req.raw, c.env));
app.get('/v1/api/services/sequence', authGuard, (c) => ServicesController.getOrderSequence(c.req.raw, c.env));
app.get('/v1/api/service/sequence', authGuard, (c) => ServicesController.getOrderSequence(c.req.raw, c.env));

/**
 * @description Update Service Order Sequence (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/services/order-sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/service/order-sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/services/sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/service/sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/services/reorder', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/service/reorder', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/services/order-sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/service/order-sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/services/sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/service/sequence', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/services/reorder', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/service/reorder', authGuard, requireAdmin, (c) => ServicesController.updateOrderSequence(c.req.raw, c.env));

/**
 * @description List Services (Public callers see status=1; admin callers see all)
 * @method GET
 */
app.get('/v1/api/services', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return ServicesController.list(c.req.raw, c.env, isAdmin);
});
app.get('/v1/api/service', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return ServicesController.list(c.req.raw, c.env, isAdmin);
});

/**
 * @description Create Service (admin only)
 * @method POST
 */
app.post('/v1/api/services', authGuard, requireAdmin, (c) => ServicesController.create(c.req.raw, c.env));
app.post('/v1/api/service', authGuard, requireAdmin, (c) => ServicesController.create(c.req.raw, c.env));

// ---------------------------------------------------------------------------
// 2. Parameterized routes by ID
// ---------------------------------------------------------------------------

/**
 * @description Get Service by ID
 * @method GET
 */
app.get('/v1/api/services/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return ServicesController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});
app.get('/v1/api/service/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return ServicesController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});

/**
 * @description Update Service (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/services/:id', authGuard, requireAdmin, (c) => ServicesController.update(c.req.raw, c.env, c.req.param('id')));
app.put('/v1/api/service/:id', authGuard, requireAdmin, (c) => ServicesController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/services/:id', authGuard, requireAdmin, (c) => ServicesController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/service/:id', authGuard, requireAdmin, (c) => ServicesController.update(c.req.raw, c.env, c.req.param('id')));

/**
 * @description Delete Service (admin only)
 * @method DELETE
 */
app.delete('/v1/api/services/:id', authGuard, requireAdmin, (c) => ServicesController.delete(c.req.raw, c.env, c.req.param('id')));
app.delete('/v1/api/service/:id', authGuard, requireAdmin, (c) => ServicesController.delete(c.req.raw, c.env, c.req.param('id')));

export { app as servicesRoutes };
