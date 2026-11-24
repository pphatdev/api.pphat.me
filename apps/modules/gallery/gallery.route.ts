import { Hono } from 'hono';
import { GalleryController } from './gallery.controller';
import { authGuard, requireAdmin, optionalAuth } from '../../middlewares/auth.middleware';
import type { AppEnv } from './gallery.interface';

const app = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// 1. Literal routes (MUST precede `/:id` to avoid path capture)
// ---------------------------------------------------------------------------

/**
 * @description List public gallery items
 * @method GET
 */
app.get('/v1/api/gallery/public', (c) => GalleryController.list(c.req.raw, c.env, false));
app.get('/v1/api/galleries/public', (c) => GalleryController.list(c.req.raw, c.env, false));

/**
 * @description Get featured gallery items (public)
 * @method GET
 */
app.get('/v1/api/gallery/featured', (c) => GalleryController.getFeatured(c.req.raw, c.env));
app.get('/v1/api/galleries/featured', (c) => GalleryController.getFeatured(c.req.raw, c.env));

/**
 * @description Get gallery statistics (admin/public overview)
 * @method GET
 */
app.get('/v1/api/gallery/stats', (c) => GalleryController.getStats(c.req.raw, c.env));
app.get('/v1/api/galleries/stats', (c) => GalleryController.getStats(c.req.raw, c.env));

/**
 * @description Get Gallery Order Sequence
 * @method GET
 */
app.get('/v1/api/gallery/order-sequence', authGuard, (c) => GalleryController.getOrderSequence(c.req.raw, c.env));
app.get('/v1/api/gallery/sequence', authGuard, (c) => GalleryController.getOrderSequence(c.req.raw, c.env));
app.get('/v1/api/galleries/order-sequence', authGuard, (c) => GalleryController.getOrderSequence(c.req.raw, c.env));

/**
 * @description Update Gallery Order Sequence (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/gallery/order-sequence', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/gallery/sequence', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));
app.put('/v1/api/gallery/reorder', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/gallery/order-sequence', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/gallery/sequence', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));
app.patch('/v1/api/gallery/reorder', authGuard, requireAdmin, (c) => GalleryController.updateOrderSequence(c.req.raw, c.env));

/**
 * @description List Gallery Items (Public sees active; Admin sees all or filters)
 * @method GET
 */
app.get('/v1/api/gallery', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return GalleryController.list(c.req.raw, c.env, isAdmin);
});
app.get('/v1/api/galleries', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return GalleryController.list(c.req.raw, c.env, isAdmin);
});

/**
 * @description Create Gallery Item(s) (admin only)
 * Supports single item or array of items.
 * @method POST
 */
app.post('/v1/api/gallery', authGuard, requireAdmin, (c) => GalleryController.create(c.req.raw, c.env));
app.post('/v1/api/galleries', authGuard, requireAdmin, (c) => GalleryController.create(c.req.raw, c.env));

// ---------------------------------------------------------------------------
// 2. Specific item actions
// ---------------------------------------------------------------------------

/**
 * @description Quick toggle public visibility
 * @method PATCH
 */
app.patch('/v1/api/gallery/:id/toggle-public', authGuard, requireAdmin, (c) => GalleryController.togglePublic(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/galleries/:id/toggle-public', authGuard, requireAdmin, (c) => GalleryController.togglePublic(c.req.raw, c.env, c.req.param('id')));

/**
 * @description Quick toggle featured status
 * @method PATCH
 */
app.patch('/v1/api/gallery/:id/toggle-featured', authGuard, requireAdmin, (c) => GalleryController.toggleFeatured(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/galleries/:id/toggle-featured', authGuard, requireAdmin, (c) => GalleryController.toggleFeatured(c.req.raw, c.env, c.req.param('id')));

// ---------------------------------------------------------------------------
// 3. Parameterized routes by ID
// ---------------------------------------------------------------------------

/**
 * @description Get Gallery Item by ID
 * @method GET
 */
app.get('/v1/api/gallery/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return GalleryController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});
app.get('/v1/api/galleries/:id', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return GalleryController.getById(c.req.raw, c.env, c.req.param('id'), isAdmin);
});

/**
 * @description Update Gallery Item (admin only)
 * @method PUT, PATCH
 */
app.put('/v1/api/gallery/:id', authGuard, requireAdmin, (c) => GalleryController.update(c.req.raw, c.env, c.req.param('id')));
app.put('/v1/api/galleries/:id', authGuard, requireAdmin, (c) => GalleryController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/gallery/:id', authGuard, requireAdmin, (c) => GalleryController.update(c.req.raw, c.env, c.req.param('id')));
app.patch('/v1/api/galleries/:id', authGuard, requireAdmin, (c) => GalleryController.update(c.req.raw, c.env, c.req.param('id')));

/**
 * @description Delete Gallery Item (admin only)
 * @method DELETE
 */
app.delete('/v1/api/gallery/:id', authGuard, requireAdmin, (c) => GalleryController.delete(c.req.raw, c.env, c.req.param('id')));
app.delete('/v1/api/galleries/:id', authGuard, requireAdmin, (c) => GalleryController.delete(c.req.raw, c.env, c.req.param('id')));

export { app as galleryRoutes };
