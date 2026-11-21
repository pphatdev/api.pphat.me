import { Hono } from 'hono';
import { FaqsController } from './faqs.controller';
import { authGuard, requireAdmin, optionalAuth } from '../../middlewares/auth.middleware';
import type { AppEnv } from './faqs.interface';

const app = new Hono<AppEnv>();

/**
 * @description List FAQs (authenticated management endpoint).
 * Admins see all FAQs (or filter with ?status=); non-admins see active FAQs.
 * @method GET
 * ---------------------------------------
 * @param { Number } page
 * @param { Number } limit (-1 for all)
 * @param { String } search - Match against question, answer, category
 * @param { String } category - Filter by category
 * @param { String } status - Filter by status (0, 1, or 'all')
 * @param { String } sort - id, question, slug, category, sort_order, status, created_at, updated_at
 * @param { String } order - asc | desc
 */
app.get('/v1/api/faqs', authGuard, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return FaqsController.list(c.req.raw, c.env, isAdmin);
});

/**
 * @description List active FAQs (public endpoint)
 * @method GET
 */
app.get('/v1/api/faqs/public', (c) => FaqsController.list(c.req.raw, c.env, false));

/**
 * @description Create FAQ (admin-only)
 * The answer field supports rich markdown / article content (or links to an article).
 * @method POST
 * ---------------------------------------
 * @param { String } question - Required
 * @param { String } [answer] - Rich article content (or `content` alias)
 * @param { String } [slug] - Unique slug (auto-generated from question if omitted)
 * @param { String } [category] - Default: 'General'
 * @param { Number } [sort_order] - Default: 0 (also `sortOrder`)
 * @param { Number } [status] - 0 inactive, 1 active (default 1)
 * @param { String } [article_id] - Optional UUID reference to an article (also `articleId`)
 */
app.post('/v1/api/faqs', authGuard, requireAdmin, (c) => FaqsController.create(c.req.raw, c.env));

/**
 * @description Get FAQ by id or slug (public).
 * Inactive FAQs (status=0) require admin authentication.
 * @method GET
 */
app.get('/v1/api/faqs/:idOrSlug', optionalAuth, (c) => {
	const user = c.get('user');
	const isAdmin = user?.role === 'admin';
	return FaqsController.getByIdOrSlug(c.req.raw, c.env, c.req.param('idOrSlug')!, isAdmin);
});

/**
 * @description Update FAQ (partial, admin-only)
 * @method PUT, PATCH
 */
app.put('/v1/api/faqs/:id', authGuard, requireAdmin, (c) => FaqsController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/faqs/:id', authGuard, requireAdmin, (c) => FaqsController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete FAQ (admin-only)
 * @method DELETE
 */
app.delete('/v1/api/faqs/:id', authGuard, requireAdmin, (c) => FaqsController.delete(c.req.raw, c.env, c.req.param('id')!));

export { app as faqRoutes };
