import { Hono } from 'hono';
import { AuthorsController } from './authors.controller';
import { authGuard }         from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

app.get   ('/v1/api/authors',     (c) => AuthorsController.handle(c.req.raw, c.env));
app.post  ('/v1/api/authors',     authGuard, (c) => AuthorsController.handle(c.req.raw, c.env));

app.get   ('/v1/api/authors/:id', (c) => AuthorsController.handle(c.req.raw, c.env, c.req.param('id')));
app.put   ('/v1/api/authors/:id', authGuard, (c) => AuthorsController.handle(c.req.raw, c.env, c.req.param('id')));
app.patch ('/v1/api/authors/:id', authGuard, (c) => AuthorsController.handle(c.req.raw, c.env, c.req.param('id')));
app.delete('/v1/api/authors/:id', authGuard, (c) => AuthorsController.handle(c.req.raw, c.env, c.req.param('id')));

export { app as authorRoutes };
