import { Hono } from 'hono';
import { AiController } from './ai.controller';
import { authGuard } from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description Generate article/project description or markdown content using Cloudflare Workers AI.
 * @method POST
 * @param { String } title Required title/topic for generation
 * @param { String } [context] Optional additional context
 * @param { String } [tone] Optional writing tone (default: professional and clear)
 * @param { String } [language] Optional output language (default: English)
 * @param { ('description'|'content'|'both') } [mode] Output mode (default: both)
 * @param { String } [model] Optional Workers AI model override
 */
app.post('/v1/api/ai/generate', authGuard, (c) => AiController.generate(c.req.raw, c.env));

export { app as aiRoutes };
