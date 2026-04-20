import { Hono } from 'hono';
import { ArticlesController }         from './articles.controller';
import { ArticleStatsController }     from '../article-stats/article-stats.controller';
import { ArticleReactionsController } from '../article-reactions/article-reactions.controller';
import { ArticleCommentsController }  from '../article-comments/article-comments.controller';
import { authGuard }                  from '../../middlewares/auth.middleware';

type AppEnv = { Bindings: Env; Variables: { articleId: string } };

const app = new Hono<AppEnv>();


/**
 * @description Get Article List
 * @method GET
 * ---------------------------------------
 * @param { Number } page - The page number for pagination
 * @param { Number } limit - The number of items per page
 * @param { String } search - The search query
 * @param { String } sort - The field to sort by
 * @param { String } order - The sort order (asc or desc)
*/
app.get('/v1/api/articles', (c) => ArticlesController.list(c.req.raw, c.env));

/**
 * @description Create Article
 * @method POST
 * ---------------------------------------
 * @param { String } title - The title of the article
 * @param { String } slug - The slug of the article
 * @param { String } description - The description of the article
 * @param { String } [thumbnail] - The thumbnail URL of the article
 * @param { String } [content] - The content of the article
 * @param { String } [file_path] - The file path of the article
 * @param { Boolean } [published] - The published status of the article
 * @param { Array<Number> } [author_ids] - The IDs of the authors associated with the article
 * @param { Array<{tag: String, description?: String}> } [tags] - The tags associated with the article
*/
app.post('/v1/api/articles', authGuard, (c) => ArticlesController.create(c.req.raw, c.env));

/**
 * @description Get Article Stats
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.get('/v1/api/articles/:slug/stats', ArticlesController.resolveArticle, (c) => ArticleStatsController.get(c.req.raw, c.env, c.get('articleId')));

/**
 * @description Increment Article View Count
 * @method POST
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.post('/v1/api/articles/:slug/stats/view', authGuard, ArticlesController.resolveArticle, (c) => ArticleStatsController.incrementViews(c.req.raw, c.env, c.get('articleId')));

/**
 * @description List Article Reactions
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.get('/v1/api/articles/:slug/reactions', ArticlesController.resolveArticle, (c) => ArticleReactionsController.list(c.req.raw, c.env, c.get('articleId')));

/**
 * @description Create Article Reaction
 * @method POST
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { String } type - The type of reaction (e.g., like, love)
*/
app.post('/v1/api/articles/:slug/reactions', authGuard, ArticlesController.resolveArticle, (c) => ArticleReactionsController.create(c.req.raw, c.env, c.get('articleId')));

/**
 * @description Increment Article Reaction by Type
 * @method POST
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { String } type - The reaction type to increment
*/
app.post('/v1/api/articles/:slug/reactions/:type', authGuard, ArticlesController.resolveArticle, (c) => ArticleReactionsController.incrementByType(c.req.raw, c.env, c.get('articleId'), c.req.param('type')!));

/**
 * @description Decrement Article Reaction by Type
 * @method DELETE
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { String } type - The reaction type to decrement
*/
app.delete('/v1/api/articles/:slug/reactions/:type', authGuard, ArticlesController.resolveArticle, (c) => ArticleReactionsController.decrementByType(c.req.raw, c.env, c.get('articleId'), c.req.param('type')!));

/**
 * @description List Article Comments
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { Number } page - The page number for pagination
 * @param { Number } limit - The number of items per page
*/
app.get('/v1/api/articles/:slug/comments', ArticlesController.resolveArticle, (c) => ArticleCommentsController.list(c.req.raw, c.env, c.get('articleId')));

/**
 * @description Create Article Comment
 * @method POST
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { String } authorName - The name of the comment author
 * @param { String } content - The content of the comment
*/
app.post('/v1/api/articles/:slug/comments', authGuard, ArticlesController.resolveArticle, (c) => ArticleCommentsController.create(c.req.raw, c.env, c.get('articleId')));

/**
 * @description Update Article Comment
 * @method PATCH
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { Number } id - The ID of the comment
 * @param { String } content - The updated content of the comment
*/
app.patch('/v1/api/articles/:slug/comments/:id', authGuard, ArticlesController.resolveArticle, (c) => ArticleCommentsController.update(c.req.raw, c.env, c.get('articleId'), c.req.param('id')!));

/**
 * @description Delete Article Comment
 * @method DELETE
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { Number } id - The ID of the comment
*/
app.delete('/v1/api/articles/:slug/comments/:id', authGuard, ArticlesController.resolveArticle, (c) => ArticleCommentsController.delete(c.req.raw, c.env, c.get('articleId'), c.req.param('id')!));

/**
 * @description Get Article Tags
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.get('/v1/api/articles/:slug/tags', ArticlesController.resolveArticle, ArticlesController.getTagsArticle);

/**
 * @description Get Article By Slug
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.get('/v1/api/articles/:slug', (c) => ArticlesController.getBySlug(c.req.raw, c.env, c.req.param('slug')!));

/**
 * @description Update Article
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { String } slug - The slug of the article
 * @param { String } [title] - The title of the article
 * @param { String } [slug] - The new slug of the article
 * @param { String } [description] - The description of the article
 * @param { String } [thumbnail] - The thumbnail URL of the article
 * @param { String } [content] - The content of the article
 * @param { String } [file_path] - The file path of the article
 * @param { Boolean } [published] - The published status of the article
 * @param { Array<Number> } [author_ids] - The IDs of the authors associated with the article
 * @param { Array<{tag: String, description?: String}> } [tags] - The tags associated with the article
*/
app.put('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.update(c.req.raw, c.env, c.req.param('slug')!));
app.patch('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.update(c.req.raw, c.env, c.req.param('slug')!));

/**
 * @description Delete Article
 * @method DELETE
 * ---------------------------------------
 * @param { String } slug - The slug of the article
*/
app.delete('/v1/api/articles/:slug', authGuard, (c) => ArticlesController.delete(c.req.raw, c.env, c.req.param('slug')!));

export { app as articleRoutes };
