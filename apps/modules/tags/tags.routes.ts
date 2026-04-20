import { Hono } from 'hono';
import { TagsController } from './tags.controller';
import { authGuard }      from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

app.get   ('/v1/api/tags',     (c) => TagsController.handle(c.req.raw, c.env));
app.post  ('/v1/api/tags',     authGuard, (c) => TagsController.handle(c.req.raw, c.env));

app.get   ('/v1/api/tags/:id', (c) => TagsController.handle(c.req.raw, c.env, c.req.param('id')));
app.put   ('/v1/api/tags/:id', authGuard, (c) => TagsController.handle(c.req.raw, c.env, c.req.param('id')));
app.patch ('/v1/api/tags/:id', authGuard, (c) => TagsController.handle(c.req.raw, c.env, c.req.param('id')));
app.delete('/v1/api/tags/:id', authGuard, (c) => TagsController.handle(c.req.raw, c.env, c.req.param('id')));

export { app as tagRoutes };
