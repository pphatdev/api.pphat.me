import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ArticleRepository } from './modules/articles/articles.repo';
import { authRoutes } from './modules/auth/auth.route';
import { articleRoutes } from './modules/articles/articles.route';
import { projectRoutes } from './modules/projects/projects.route';
import { authorRoutes } from './modules/authors/authors.routes';
import { tagRoutes } from './modules/tags/tags.routes';
import { techStackRoutes } from './modules/tech-stacks/tech-stacks.route';
import { experienceRoutes } from './modules/experiences/experiences.route';
import { skillRoutes } from './modules/skills/skills.route';
import { faqRoutes } from './modules/faqs/faqs.route';
import { aboutMeRoutes } from './modules/about-me/about-me.route';
import { galleryRoutes } from './modules/gallery/gallery.route';
import { servicesRoutes } from './modules/services/services.route';
import { aiRoutes } from './modules/ai/ai.route';
import { chatRoutes } from './modules/chat/chat.route';
import { contactRoutes } from './modules/contact/contact.route';
import { dashboardRoutes } from './modules/dashboard/dashboard.route';
import { llmsRoutes } from './modules/llms/llms.route';
import { userRoutes } from './modules/users/users.route';
import { articleInvitationRoutes } from './modules/article-invitations/article-invitations.route';
import { bodyLimitMiddleware } from './middlewares/body-limit.middleware';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { securityMiddleware } from './middlewares/security.middleware';
import { trafficMiddleware } from './middlewares/traffic.middleware';
import { apiCacheMiddleware } from './middlewares/cache.middleware';
import { withQueryLog } from './shared/db/query-log';
import { resolveAllowedOrigin } from './shared/config/cors';
import { resolveEnv } from './shared/db';

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
// After rate limiting so cached hits still count; see cache.middleware.ts.
app.use('/v1/api/*', apiCacheMiddleware);
app.get('/', (c) => c.json({ message: 'Welcome to the API', version: packageJson.version }));

app.route('/', authRoutes);
app.route('/', articleRoutes);
app.route('/', articleInvitationRoutes);
app.route('/', projectRoutes);
app.route('/', authorRoutes);
app.route('/', tagRoutes);
app.route('/', techStackRoutes);
app.route('/', experienceRoutes);
app.route('/', skillRoutes);
app.route('/', faqRoutes);
app.route('/', aboutMeRoutes);
app.route('/', galleryRoutes);
app.route('/', servicesRoutes);
app.route('/', aiRoutes);
app.route('/', chatRoutes);
app.route('/', contactRoutes);
app.route('/', dashboardRoutes);
app.route('/', llmsRoutes);
app.route('/', userRoutes);

// visitor_logs retention window in days (#33). 30 days is enough for the
// dashboard's live-traffic aggregations and short enough that a leaked DB
// dump does not carry months of behavioural history keyed by (hashed) IP.
const VISITOR_LOG_RETENTION_DAYS = 30;

/**
 * Cloudflare Cron Trigger entry point.
 * Configured in wrangler.jsonc as `*​/5 * * * *` — every 5 minutes.
 * Jobs run per tick:
 *   1. Promote scheduled articles whose `publish_at` (UTC) has elapsed.
 *   2. (hourly) Sweep anonymous view markers older than 2 days.
 *   3. (hourly) Sweep visitor_logs rows older than the retention window (#33).
 * Both are wrapped in try/catch so one failure does not silence the other.
 */
/**
 * @description The cron fires every 5 minutes; retention sweeps only need to
 * run hourly. True for the tick in the first 5 minutes of each UTC hour.
 * @param { number } scheduledTime Cron tick time (ms since epoch)
 * @returns { boolean }
 */
export function isHourlyTick(scheduledTime: number): boolean {
    return new Date(scheduledTime).getUTCMinutes() < 5;
}

async function scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const hourly = isHourlyTick(event.scheduledTime);
    ctx.waitUntil((async () => {
        try {
            const promoted = await new ArticleRepository(env.DB).promoteScheduled();
            if (promoted > 0) console.log(`[cron:articles] promoted ${promoted} scheduled article(s) to public`);
        } catch (err) {
            console.error('[cron:articles] promoteScheduled failed', err);
        }

        // Retention sweeps: hourly is plenty (both are index-backed seeks).
        if (!hourly) return;

        try {
            // Anonymous view markers only dedupe within the current UTC day.
            await env.DB
                .prepare("DELETE FROM article_view_visitor WHERE day < date('now', '-2 days')")
                .run();
        } catch (err) {
            console.error('[cron:article_view_visitor] sweep failed', err);
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
    // resolveEnv: swaps env.DB for the Turso adapter when DB_DRIVER=turso.
    // withQueryLog: dev-only rows-read logging when DB_QUERY_LOG=1 (no-op
    // otherwise). On Turso it logs 0 rows: libSQL results carry no rows_read.
    fetch: (request, env, ctx) => app.fetch(request, withQueryLog(resolveEnv(env)), ctx),
    scheduled: (event, env, ctx) => scheduled(event, withQueryLog(resolveEnv(env)), ctx),
} satisfies ExportedHandler<Env>;
