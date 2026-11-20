import { Hono } from 'hono';
import { TechStacksController } from './tech-stacks.controller';
import { authGuard, requireAdmin } from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description List tech stacks
 * @method GET
 * ---------------------------------------
 * @param { Number } page - Page number
 * @param { Number } limit - Items per page
 * @param { String } search - Match against name / description
 * @param { String } sort - Sort column (id, name, status, created_at, updated_at)
 * @param { String } order - Sort direction (asc | desc)
 */
app.get('/v1/api/tech-stacks', authGuard, (c) => TechStacksController.list(c.req.raw, c.env));

/**
 * @description Create tech stack
 * @method POST
 * ---------------------------------------
 * @param { String } name - Required
 * @param { String } [description]
 * @param { String } [url]
 * @param { String } [logo_url] - Accepts `logoUrl` camelCase alias too
 * @param { String } [cover] - Optional cover image URL
 * @param { Number } [status] - 0 inactive, 1 active (default 1)
 */
app.post('/v1/api/tech-stacks', authGuard, requireAdmin, (c) => TechStacksController.create(c.req.raw, c.env));

/**
 * @description Get tech stack by id
 * @method GET
 * ---------------------------------------
 * @param { Number } id - Tech stack id
 */
app.get('/v1/api/tech-stacks/:id', (c) => TechStacksController.getById(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Update tech stack (partial)
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { Number } id - Tech stack id
 */
app.put('/v1/api/tech-stacks/:id', authGuard, requireAdmin, (c) => TechStacksController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/tech-stacks/:id', authGuard, requireAdmin, (c) => TechStacksController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete tech stack
 * @method DELETE
 * ---------------------------------------
 * @param { Number } id - Tech stack id
 */
app.delete('/v1/api/tech-stacks/:id', authGuard, requireAdmin, (c) => TechStacksController.delete(c.req.raw, c.env, c.req.param('id')!));

export { app as techStackRoutes };
