import { Hono } from 'hono';
import { ExperiencesController } from './experiences.controller';
import { authGuard, requireAdmin } from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description List experiences (resume timeline)
 * @method GET
 * ---------------------------------------
 * @param { Number } page - Page number
 * @param { Number } limit - Items per page
 * @param { String } search - Match against title / company / description
 * @param { String } sort - Override default sort (id, title, company, start_date, end_date, status, created_at, updated_at)
 * @param { String } order - asc | desc
 * ---------------------------------------
 * Default order: ongoing roles (end_date IS NULL) first, then start_date DESC.
 */
app.get('/v1/api/experiences', authGuard, (c) => ExperiencesController.list(c.req.raw, c.env));

/**
 * @description Resume timeline (public)
 * @method GET
 * ---------------------------------------
 * Returns active experiences grouped by company with role + skills nesting.
 * Companies appear in timeline order (ongoing roles bubble up).
 */
app.get('/v1/api/experiences/timeline', (c) => ExperiencesController.timeline(c.req.raw, c.env));

/**
 * @description Create experience
 * @method POST
 * ---------------------------------------
 * @param { String } title - Required
 * @param { String } company - Required
 * @param { String } start_date - Required (ISO date or YYYY-MM)
 * @param { String } [end_date] - Nullable (NULL = current role)
 * @param { String } [description]
 * @param { String } [location]
 * @param { String } [employment_type] - full-time | part-time | contract | internship | freelance (default full-time)
 * @param { String } [company_url]
 * @param { String } [logo_url]
 * @param { String } [cover] - Optional cover image URL
 * @param { Number } [status] - 0 inactive, 1 active (default 1)
 */
app.post('/v1/api/experiences', authGuard, requireAdmin, (c) => ExperiencesController.create(c.req.raw, c.env));

/**
 * @description Get experience by id
 * @method GET
 * ---------------------------------------
 * @param { Number } id - Experience id
 */
app.get('/v1/api/experiences/:id', (c) => ExperiencesController.getById(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Update experience (partial)
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { Number } id - Experience id
 */
app.put('/v1/api/experiences/:id', authGuard, requireAdmin, (c) => ExperiencesController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/experiences/:id', authGuard, requireAdmin, (c) => ExperiencesController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete experience
 * @method DELETE
 * ---------------------------------------
 * @param { Number } id - Experience id
 */
app.delete('/v1/api/experiences/:id', authGuard, requireAdmin, (c) => ExperiencesController.delete(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Replace all skills (tech stacks) linked to an experience
 * @method PUT
 * ---------------------------------------
 * @param { Number } id - Experience id
 * @param { Array<Number> } tech_stack_ids - Tech stack ids (also accepts `techStackIds`)
 */
app.put('/v1/api/experiences/:id/skills', authGuard, requireAdmin, (c) => ExperiencesController.setSkills(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Attach a single tech stack to an experience
 * @method POST
 * ---------------------------------------
 * @param { Number } id - Experience id
 * @param { Number } techStackId - Tech stack id
 */
app.post('/v1/api/experiences/:id/skills/:techStackId', authGuard, requireAdmin, (c) => ExperiencesController.attachSkill(c.req.raw, c.env, c.req.param('id')!, c.req.param('techStackId')!));

/**
 * @description Detach a single tech stack from an experience
 * @method DELETE
 * ---------------------------------------
 * @param { Number } id - Experience id
 * @param { Number } techStackId - Tech stack id
 */
app.delete('/v1/api/experiences/:id/skills/:techStackId', authGuard, requireAdmin, (c) => ExperiencesController.detachSkill(c.req.raw, c.env, c.req.param('id')!, c.req.param('techStackId')!));

export { app as experienceRoutes };
