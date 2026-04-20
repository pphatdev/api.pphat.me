import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { ArticlesController }         from './articles.controller';
import { ArticleStatsController }     from '../article-stats/article-stats.controller';
import { ArticleReactionsController } from '../article-reactions/article-reactions.controller';
import { ArticleCommentsController }  from '../article-comments/article-comments.controller';
import { TagRepository }              from '../tags/tags.repo';
import { ListTagsByArticle }          from '../tags/tags.service';
import { authGuard }                  from '../../middlewares/auth.middleware';

type AppEnv = { Bindings: Env; Variables: { articleId: string } };

const app = new Hono<AppEnv>();

/** Resolve article by slug, store id in context, or 404. */
const resolveArticle = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
	const article = await c.env.DB
		.prepare('SELECT id FROM articles WHERE slug = ?1')
		.bind(c.req.param('slug'))
		.first<{ id: string }>();
	if (!article) return c.json({ error: 'Not Found' }, 404);
	c.set('articleId', article.id);
	return next();
};

// Collection
app.get ('/v1/api/articles', (c) => ArticlesController.handle(c.req.raw, c.env));
app.post('/v1/api/articles', authGuard, (c) => ArticlesController.handle(c.req.raw, c.env));

// Stats (specific paths before :slug catch-all)
app.get ('/v1/api/articles/:slug/stats',      resolveArticle, (c) => ArticleStatsController.handle(c.req.raw, c.env, c.get('articleId')));
app.post('/v1/api/articles/:slug/stats/view', authGuard, resolveArticle, (c) => ArticleStatsController.handle(c.req.raw, c.env, c.get('articleId'), 'view'));

// Reactions
app.get   ('/v1/api/articles/:slug/reactions',       resolveArticle, (c) => ArticleReactionsController.handle(c.req.raw, c.env, c.get('articleId')));
app.post  ('/v1/api/articles/:slug/reactions',       authGuard, resolveArticle, (c) => ArticleReactionsController.handle(c.req.raw, c.env, c.get('articleId')));
app.post  ('/v1/api/articles/:slug/reactions/:type', authGuard, resolveArticle, (c) => ArticleReactionsController.handle(c.req.raw, c.env, c.get('articleId'), c.req.param('type')));
app.delete('/v1/api/articles/:slug/reactions/:type', authGuard, resolveArticle, (c) => ArticleReactionsController.handle(c.req.raw, c.env, c.get('articleId'), c.req.param('type')));

// Comments
app.get   ('/v1/api/articles/:slug/comments',      resolveArticle, (c) => ArticleCommentsController.handle(c.req.raw, c.env, c.get('articleId')));
app.post  ('/v1/api/articles/:slug/comments',      authGuard, resolveArticle, (c) => ArticleCommentsController.handle(c.req.raw, c.env, c.get('articleId')));
app.patch ('/v1/api/articles/:slug/comments/:id',  authGuard, resolveArticle, (c) => ArticleCommentsController.handle(c.req.raw, c.env, c.get('articleId'), c.req.param('id')));
app.delete('/v1/api/articles/:slug/comments/:id',  authGuard, resolveArticle, (c) => ArticleCommentsController.handle(c.req.raw, c.env, c.get('articleId'), c.req.param('id')));

// Tags by article (GET only)
app.get('/v1/api/articles/:slug/tags', resolveArticle, async (c) => {
	const tags = await new ListTagsByArticle(new TagRepository(c.env.DB)).execute(c.get('articleId'));
	return c.json(tags);
});

// Article detail (after sub-routes)
app.get   ('/v1/api/articles/:slug', (c) => ArticlesController.handle(c.req.raw, c.env, c.req.param('slug')));
app.put   ('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.handle(c.req.raw, c.env, c.req.param('slug')));
app.patch ('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.handle(c.req.raw, c.env, c.req.param('slug')));
app.delete('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.handle(c.req.raw, c.env, c.req.param('slug')));

export { app as articleRoutes };
