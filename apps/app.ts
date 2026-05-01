import { Hono } from 'hono';
import { authRoutes }    from './modules/auth/auth.route';
import { articleRoutes } from './modules/articles/articles.route';
import { projectRoutes } from './modules/projects/projects.route';
import { authorRoutes }  from './modules/authors/authors.routes';
import { tagRoutes }     from './modules/tags/tags.routes';
import { aiRoutes }      from './modules/ai/ai.route';
import { chatRoutes }    from './modules/chat/chat.route';
import { contactRoutes } from './modules/contact/contact.route';
import { dashboardRoutes } from './modules/dashboard/dashboard.route';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { securityMiddleware } from './middlewares/security.middleware';
import { trafficMiddleware } from './middlewares/traffic.middleware';

import packageJson from '../package.json';

const app = new Hono<{ Bindings: Env }>();

app.use('*', securityMiddleware);
app.use('*', trafficMiddleware);
app.use('/v1/api/*', rateLimitMiddleware);
app.get('/', (c) => c.json({ message: 'Welcome to the API', version: packageJson.version }));

app.route('/', authRoutes);
app.route('/', articleRoutes);
app.route('/', projectRoutes);
app.route('/', authorRoutes);
app.route('/', tagRoutes);
app.route('/', aiRoutes);
app.route('/', chatRoutes);
app.route('/', contactRoutes);
app.route('/', dashboardRoutes);

export default app;
