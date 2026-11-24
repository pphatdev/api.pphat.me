import { Hono } from 'hono';
import { SkillsController } from './skills.controller';
import { authGuard, requireAdmin } from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description List skills (paginated, searchable). Each skill embeds its
 * tech stack with { id, name, icon, image, url } — icon/image come from
 * tech_stacks (logo_url / cover).
 * @method GET
 * ---------------------------------------
 * @param { Number } page
 * @param { Number } limit
 * @param { String } search - Matches tech-stack name or skill description
 * @param { String } sort - id, name, level, sort_order, status, created_at, updated_at
 * @param { String } order - asc | desc
 */
app.get('/v1/api/skills', authGuard, (c) => SkillsController.list(c.req.raw, c.env));

/**
 * @description Create skill
 * @method POST
 * ---------------------------------------
 * @param { Number } tech_stack_id - Required, FK into tech_stacks (also `techStackId`)
 * @param { String } [level] - beginner | intermediate | advanced | expert (default intermediate)
 * @param { Number } [years_of_experience] - Nullable float (also `yearsOfExperience`)
 * @param { String } [description]
 * @param { Number } [sort_order] - Integer, default 0 (also `sortOrder`)
 * @param { Number } [status] - 0 inactive, 1 active (default 1)
 */
app.post('/v1/api/skills', authGuard, requireAdmin, (c) => SkillsController.create(c.req.raw, c.env));

/**
 * @description Get skill by id (public)
 * @method GET
 */
app.get('/v1/api/skills/:id', (c) => SkillsController.getById(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Update skill (partial)
 * @method PUT, PATCH
 */
app.put('/v1/api/skills/:id', authGuard, requireAdmin, (c) => SkillsController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/skills/:id', authGuard, requireAdmin, (c) => SkillsController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete skill
 * @method DELETE
 */
app.delete('/v1/api/skills/:id', authGuard, requireAdmin, (c) => SkillsController.delete(c.req.raw, c.env, c.req.param('id')!));

export { app as skillRoutes };
