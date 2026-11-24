import { Hono } from 'hono';
import { LlmsController } from './llms.controller';

const app = new Hono<{ Bindings: Env }>();

/**
 * llms.txt generator — paths mirror the public site so a page at `/x` has its
 * machine-readable twin at `/x/llms.txt`. All routes are public and read-only;
 * they expose only content that is already published.
 */

/**
 * @description Site-wide llms.txt index (about, contact, articles, projects)
 * @method GET
 */
app.get('/llms.txt', (c) => LlmsController.index(c.req.raw, c.env));

/**
 * @description llms.txt for a published article
 * @method GET
 * @param { String } slug Article slug
 */
app.get('/articles/:slug/llms.txt', (c) => LlmsController.article(c.req.raw, c.env, c.req.param('slug')));

/**
 * @description llms.txt for a published project
 * @method GET
 * @param { String } slug Project slug
 */
app.get('/projects/:slug/llms.txt', (c) => LlmsController.project(c.req.raw, c.env, c.req.param('slug')));

/**
 * @description llms.txt for the About page (active About Me profile + About FAQs)
 * @method GET
 */
app.get('/about/llms.txt', (c) => LlmsController.about(c.req.raw, c.env));

/**
 * @description llms.txt for the Contact page (how to reach out; never exposes submitted messages)
 * @method GET
 */
app.get('/contact/llms.txt', (c) => LlmsController.contact(c.req.raw, c.env));

export { app as llmsRoutes };
