import { Res } from "../../shared/helpers/response";
import { ArticleStatsRepository } from "./article-stats.repo";
import { ArticleStatsService } from "./article-stats.service";

export class ArticleStatsController {

	/**
	 * @description Get stats for an article
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } The article stats
	 */
	static async get(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).get(articleId);
		if (!stats) return Res.notFound("Stats not found");
		return Res.ok(stats);
	}

	/**
	 * @description Increment view count for an article
	 * @method PATCH
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } The updated stats
	 */
	static async incrementViews(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).incrementViews(articleId);
		return Res.ok(stats);
	}
}
