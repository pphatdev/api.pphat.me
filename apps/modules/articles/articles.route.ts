import { Hono } from 'hono';
import { ArticlesController } from './articles.controller';
import { ArticleStatsController } from '../article-stats/article-stats.controller';
import { ArticleReactionsController } from '../article-reactions/article-reactions.controller';
import { ArticleCommentsController } from '../article-comments/article-comments.controller';
import { authGuard, optionalAuth } from '../../middlewares/auth.middleware';
import type { AppEnv } from './articles.interface';

const app = new Hono<AppEnv>();

/**
 * @description Get Article List (public — published only)
 * @method GET
 * @param { Number } page               Current Page    page=1
 * @param { Number } limit              Items per Page  limit=10
 * @param { String } search             Search Query   search=
 * @param { ('asc' | 'desc') } order    Sort Order     order=asc
 * @param { String[] } [sort]           Sort Columns   sort=col1,col2
 * @param { String[] } [tags]           Filter by Tags tags=tag1,tag2
 * @param { String[] } [authors]        Filter by Authors authors=author1,author2
 *
 * @example `GET /v1/api/articles?page=1&limit=10&search=example&sort=title,name&order=asc&tags=tag1,tag2&authors=author1,author2`
 */
app.get(
    '/v1/api/articles',
    ArticlesController.list
);

/**
 * @description Create Article (authenticated users)
 * @method POST
 * @param { String } title          Title of Articles
 * @param { String } slug           Slug of Articles
 * @param { String } description    Description of Articles
 * @param { String } content        Content of Articles
 * @param { String } thumbnail      Thumbnail of Articles
 * @param { String } file_path      File Path of Articles
 * @param { Boolean } published     Published Status of Articles
 * @param { String[] } [author_ids] Author IDs of Articles
 * @param { String[] } [tags]       Tags of Articles
 */
app.post(
    '/v1/api/articles',
    authGuard,
    ArticlesController.create
);

/**
 * @description List articles by author (owner | admin — includes drafts)
 * @method GET
 * @param { Number } authorId Author ID
 */
app.get(
    '/v1/api/articles/author/:authorId',
    optionalAuth,
    ArticlesController.listByAuthor
);

/**
 * @description Get Article Stats
 * @method GET
 * @param { String } slug   Slug of Article
 */
app.get(
    '/v1/api/articles/:slug/stats',
    ArticlesController.resolveArticle,
    (c) => ArticleStatsController.get(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description Increment Article View Count (authenticated)
 * @method POST
 * @param { String } slug   Slug of Article
 */
app.post(
    '/v1/api/articles/:slug/stats/view',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleStatsController.incrementViews(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description List Article Reactions
 * @method GET
 * @param { String } slug Slug of Article
 */
app.get(
    '/v1/api/articles/:slug/reactions',
    ArticlesController.resolveArticle,
    (c) => ArticleReactionsController.list(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description Create Article Reaction (authenticated)
 * @method POST
 * @param { String } slug Slug of Article
 * @param { String } type Type of Reaction
 */
app.post(
    '/v1/api/articles/:slug/reactions',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleReactionsController.create(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description Increment Article Reaction by Type (authenticated)
 * @method POST
 * @param { String } slug Slug of Article
 * @param { String } type Type of Reaction
 */
app.post(
    '/v1/api/articles/:slug/reactions/:type',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleReactionsController.incrementByType(c.req.raw, c.env, c.get('articleId'), c.req.param('type')!)
);

/**
 * @description Decrement Article Reaction by Type (authenticated)
 * @method DELETE
 * @param { String } slug Slug of Article
 * @param { String } type Type of Reaction
 */
app.delete(
    '/v1/api/articles/:slug/reactions/:type',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleReactionsController.decrementByType(c.req.raw, c.env, c.get('articleId'), c.req.param('type')!)
);

/**
 * @description List Article Comments
 * @method GET
 * @param { String } slug Slug of Article
 * @param { Number } page Page number
 * @param { Number } limit Number of comments per page
 */
app.get(
    '/v1/api/articles/:slug/comments',
    ArticlesController.resolveArticle,
    (c) => ArticleCommentsController.list(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description Create Article Comment (authenticated)
 * @method POST
 * @param { String } slug Slug of Article
 * @param { String } content Content of Comment
 */
app.post(
    '/v1/api/articles/:slug/comments',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleCommentsController.create(c.req.raw, c.env, c.get('articleId'))
);

/**
 * @description Update Article Comment (authenticated)
 * @method PATCH
 * @param { String } slug Slug of Article
 * @param { Number } id ID of Comment
 * @param { String } content Content of Comment
 */
app.patch(
    '/v1/api/articles/:slug/comments/:id',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleCommentsController.update(c.req.raw, c.env, c.get('articleId'), c.req.param('id')!)
);

/**
 * @description Delete Article Comment (authenticated)
 * @method DELETE
 * @param { String } slug Slug of Article
 * @param { Number } id ID of Comment
 */
app.delete(
    '/v1/api/articles/:slug/comments/:id',
    authGuard,
    ArticlesController.resolveArticle,
    (c) => ArticleCommentsController.delete(c.req.raw, c.env, c.get('articleId'), c.req.param('id')!)
);

/**
 * @description Get Article Tags
 * @method GET
 * @param { String } slug Slug of Article
 */
app.get(
    '/v1/api/articles/:slug/tags',
    ArticlesController.resolveArticle,
    ArticlesController.getTagsArticle
);

/**
 * @description Add Contributor to Article (owner | admin)
 * @method POST
 * @param { String } id Article ID (UUID)
 * @param { String } user_id User ID
 */
app.post(
    '/v1/api/articles/:id/contributors',
    authGuard,
    ArticlesController.addContributor
);

/**
 * @description Remove self from article contributors (authenticated contributor)
 * @method DELETE
 * @param { String } id Article ID (UUID)
 */
app.delete(
    '/v1/api/articles/:id/contributors/me',
    authGuard,
    ArticlesController.removeSelfAsContributor
);

/**
 * @description Get Article by slug or UUID id (public)
 * @method GET
 * @param { String } slug Slug string or UUID
 */
app.get(
    '/v1/api/articles/:slug',
    ArticlesController.getBySlugOrId
);

/**
 * @description Update Article (owner | contributor | admin)
 * @method PUT, PATCH
 * @param { String } id Article ID (UUID)
 */
app.put(
    '/v1/api/articles/:id',
    authGuard,
    ArticlesController.requireWriteAccess,
    ArticlesController.update
);
app.patch(
    '/v1/api/articles/:id',
    authGuard,
    ArticlesController.requireWriteAccess,
    ArticlesController.update
);

/**
 * @description Delete Article (owner | admin)
 * @method DELETE
 * @param { String } id Article ID (UUID)
 */
app.delete(
    '/v1/api/articles/:id',
    authGuard,
    ArticlesController.requireDeleteAccess,
    ArticlesController.delete
);

export { app as articleRoutes };

