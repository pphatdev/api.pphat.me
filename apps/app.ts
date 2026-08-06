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
import { bodyLimitMiddleware } from './middlewares/body-limit.middleware';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { securityMiddleware } from './middlewares/security.middleware';
import { trafficMiddleware } from './middlewares/traffic.middleware';
import { resolveAllowedOrigin } from './shared/config/cors';

import packageJson from '../package.json';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
    origin: (origin) => resolveAllowedOrigin(origin),
    allowHeaders: ['*'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
}));

app.use('*', securityMiddleware);
app.use('*', trafficMiddleware);
// Reject oversized bodies before they hit rate-limit counters or auth checks
// so a garbage attacker can't waste those cycles.
app.use('/v1/api/*', bodyLimitMiddleware);
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

// visitor_logs retention window in days (#33). 30 days is enough for the
// dashboard's live-traffic aggregations and short enough that a leaked DB
// dump does not carry months of behavioural history keyed by (hashed) IP.
const VISITOR_LOG_RETENTION_DAYS = 30;

/**
 * Cloudflare Cron Trigger entry point.
 * Configured in wrangler.jsonc as `*​/5 * * * *` — every 5 minutes.
 * Two jobs run per tick:
 *   1. Promote scheduled articles whose `publish_at` (UTC) has elapsed.
 *   2. Sweep visitor_logs rows older than the retention window (#33).
 * Both are wrapped in try/catch so one failure does not silence the other.
 */
async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
        try {
            const promoted = await new ArticleRepository(env.DB).promoteScheduled();
            if (promoted > 0) console.log(`[cron:articles] promoted ${promoted} scheduled article(s) to public`);
        } catch (err) {
            console.error('[cron:articles] promoteScheduled failed', err);
        }

        try {
            const res = await env.DB
                .prepare("DELETE FROM visitor_logs WHERE timestamp < datetime('now', ?1)")
                .bind(`-${VISITOR_LOG_RETENTION_DAYS} days`)
                .run();
            const removed = res.meta?.changes ?? 0;
            if (removed > 0) console.log(`[cron:visitor_logs] retention swept ${removed} row(s) older than ${VISITOR_LOG_RETENTION_DAYS} days`);
        } catch (err) {
            console.error('[cron:visitor_logs] retention sweep failed', err);
        }
    })());
}

export default {
    fetch: app.fetch,
    scheduled,
} satisfies ExportedHandler<Env>;
