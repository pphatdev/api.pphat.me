import { Hono } from 'hono';
import { AuthorsController } from './authors.controller';
import { authGuard }         from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description Get Author List
 * @method GET
 * ---------------------------------------
 * @param { Number } page - The page number for pagination
 * @param { Number } limit - The number of items per page
 * @param { String } search - The search query
 * @param { String } sort - The field to sort by
 * @param { String } order - The sort order (asc or desc)
*/
app.get('/v1/api/authors', (c) => AuthorsController.list(c.req.raw, c.env));

/**
 * @description Create Author
 * @method POST
 * ---------------------------------------
 * @param { String } name - The name of the author
 * @param { String } [profile] - The profile of the author
 * @param { String } [url] - The URL of the author
 * @param { String } [bio] - The bio of the author
 * @param { String } [avatar_url] - The avatar URL of the author
 * @param { Array<String> } [social_links] - The social links of the author
 * @param { Number } [status] - The status of the author
*/
app.post('/v1/api/authors', authGuard, (c) => AuthorsController.create(c.req.raw, c.env));

/**
 * @description Get Author By ID
 * @method GET
 * ---------------------------------------
 * @param { Number } id - The ID of the author
*/
app.get('/v1/api/authors/:id', (c) => AuthorsController.getById(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Update Author
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { Number } id - The ID of the author
 * @param { String } [name] - The name of the author
 * @param { String } [profile] - The profile of the author
 * @param { String } [url] - The URL of the author
 * @param { String } [bio] - The bio of the author
 * @param { String } [avatar_url] - The avatar URL of the author
 * @param { Array<String> } [social_links] - The social links of the author
 * @param { Number } [status] - The status of the author
*/
app.put('/v1/api/authors/:id', authGuard, (c) => AuthorsController.update(c.req.raw, c.env, c.req.param('id')!));
app.patch('/v1/api/authors/:id', authGuard, (c) => AuthorsController.update(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Delete Author
 * @method DELETE
 * ---------------------------------------
 * @param { Number } id - The ID of the author
*/
app.delete('/v1/api/authors/:id', authGuard, (c) => AuthorsController.delete(c.req.raw, c.env, c.req.param('id')!));

export { app as authorRoutes };
