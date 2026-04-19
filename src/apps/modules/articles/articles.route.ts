import { ArticlesController } from "./articles.controller";
import { ArticleStatsController } from "../article-stats/article-stats.controller";
import { ArticleReactionsController } from "../article-reactions/article-reactions.controller";
import { ArticleCommentsController } from "../article-comments/article-comments.controller";

const listPattern = new URLPattern({ pathname: "/v1/api/articles" });
const detailPattern = new URLPattern({ pathname: "/v1/api/articles/:slug" });
const statsPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/stats" });
const statsViewPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/stats/view" });
const reactionsPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/reactions" });
const reactionDetailPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/reactions/:type" });
const commentsPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/comments" });
const commentDetailPattern = new URLPattern({ pathname: "/v1/api/articles/:slug/comments/:id" });

export async function matchArticleRoutes(
	request: Request,
	env: Env,
): Promise<Response | null> {
	// Sub-routes (must be matched before the detail pattern)
	const statsViewMatch = statsViewPattern.exec(request.url);
	if (statsViewMatch) {
		const slug = statsViewMatch.pathname.groups["slug"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleStatsController.handle(request, env, article.id, "view");
	}

	const statsMatch = statsPattern.exec(request.url);
	if (statsMatch) {
		const slug = statsMatch.pathname.groups["slug"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleStatsController.handle(request, env, article.id);
	}

	const reactionDetailMatch = reactionDetailPattern.exec(request.url);
	if (reactionDetailMatch) {
		const slug = reactionDetailMatch.pathname.groups["slug"]!;
		const type = reactionDetailMatch.pathname.groups["type"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleReactionsController.handle(request, env, article.id, type);
	}

	const reactionsMatch = reactionsPattern.exec(request.url);
	if (reactionsMatch) {
		const slug = reactionsMatch.pathname.groups["slug"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleReactionsController.handle(request, env, article.id);
	}

	const commentDetailMatch = commentDetailPattern.exec(request.url);
	if (commentDetailMatch) {
		const slug = commentDetailMatch.pathname.groups["slug"]!;
		const commentId = commentDetailMatch.pathname.groups["id"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleCommentsController.handle(request, env, article.id, commentId);
	}

	const commentsMatch = commentsPattern.exec(request.url);
	if (commentsMatch) {
		const slug = commentsMatch.pathname.groups["slug"]!;
		const article = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!article) return null;
		return ArticleCommentsController.handle(request, env, article.id);
	}

	// Core article routes
	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		return ArticlesController.handle(request, env, detailMatch.pathname.groups["slug"]);
	}

	if (listPattern.test(request.url)) {
		return ArticlesController.handle(request, env);
	}

	return null;
}
