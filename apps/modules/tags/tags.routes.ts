import { Hono } from 'hono';
import { TagsController } from './tags.controller';
import { authGuard }      from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description Get Tag List
 * @method GET
 * ---------------------------------------
 * @param { Number } page - The page number for pagination
 * @param { Number } limit - The number of items per page
 * @param { String } search - The search query
 * @param { String } sort - The field to sort by
 * @param { String } order - The sort order (asc or desc)
*/
app.get('/v1/api/tags', (c) => TagsController.list(c.req.raw, c.env));

/**
 * @description Create Tag
 * @method POST
 * ---------------------------------------
 * @param { String } tag - The tag name
 * @param { String } [description] - The description of the tag
 * @param { String } [article_id] - The article ID associated with the tag
 * @param { String } [project_id] - The project ID associated with the tag
*/
app.post('/v1/api/tags', authGuard, (c) => TagsController.create(c.req.raw, c.env));

/**
 * @description Get Tag By ID
 * @method GET
 * ---------------------------------------
 * @param { Number } id - The ID of the tag
*/
app.get('/v1/api/tags/:id', (c) => TagsController.getById(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Update Tag
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { Number } id - The ID of the tag
 * @param { String } [tag] - The tag name
 * @param { String } [description] - The description of the tag
 * @param { String } [article_id] - The article ID associated with the tag
 * @param { String } [project_id] - The project ID associated with the tag
*/
app.put('/v1/api/tags/:id', authGuard, (c) => TagsController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/tags/:id', authGuard, (c) => TagsController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete Tag
 * @method DELETE
 * ---------------------------------------
 * @param { Number } id - The ID of the tag
*/
app.delete('/v1/api/tags/:id', authGuard, (c) => TagsController.delete(c.req.raw, c.env, c.req.param('id')!));

export { app as tagRoutes };
