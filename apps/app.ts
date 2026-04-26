import { Hono } from 'hono';
import { authRoutes }    from './modules/auth/auth.route';
import { articleRoutes } from './modules/articles/articles.route';
import { projectRoutes } from './modules/projects/projects.route';
import { authorRoutes }  from './modules/authors/authors.routes';
import { tagRoutes }     from './modules/tags/tags.routes';
import { aiRoutes }      from './modules/ai/ai.route';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';

const app = new Hono<{ Bindings: Env }>();

app.use('/v1/api/*', rateLimitMiddleware);
app.get('/', (c) => c.json({ message: 'Welcome to the API' }));

app.route('/', authRoutes);
app.route('/', articleRoutes);
app.route('/', projectRoutes);
app.route('/', authorRoutes);
app.route('/', tagRoutes);
app.route('/', aiRoutes);

export default app;
