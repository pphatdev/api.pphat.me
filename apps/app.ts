import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ArticleRepository } from './modules/articles/articles.repo';
import { authRoutes } from './modules/auth/auth.route';
import { articleRoutes } from './modules/articles/articles.route';
import { projectRoutes } from './modules/projects/projects.route';
import { authorRoutes } from './modules/authors/authors.routes';
import { tagRoutes } from './modules/tags/tags.routes';
import { aiRoutes } from './modules/ai/ai.route';
import { chatRoutes } from './modules/chat/chat.route';
import { contactRoutes } from './modules/contact/contact.route';
import { dashboardRoutes } from './modules/dashboard/dashboard.route';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { securityMiddleware } from './middlewares/security.middleware';
import { trafficMiddleware } from './middlewares/traffic.middleware';

import packageJson from '../package.json';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
    origin: (origin) => {
        if (!origin) return '*';
        if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost') || origin === 'https://pphat.me') {
            return origin;
        }
        return 'https://pphat.me';
    },
    allowHeaders: ['*'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
}));

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

/**
 * Cloudflare Cron Trigger entry point.
 * Configured in wrangler.jsonc as `*​/5 * * * *` — every 5 minutes.
 * Promotes scheduled articles whose `publish_at` (UTC) has elapsed, so they
 * become visible via the public list endpoint. Called by Workers runtime.
 */
async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
        try {
            const promoted = await new ArticleRepository(env.DB).promoteScheduled();
            if (promoted > 0) console.log(`[cron:articles] promoted ${promoted} scheduled article(s) to public`);
        } catch (err) {
            console.error('[cron:articles] promoteScheduled failed', err);
        }
    })());
}

export default {
    fetch: app.fetch,
    scheduled,
} satisfies ExportedHandler<Env>;
