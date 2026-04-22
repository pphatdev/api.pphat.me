import { Res } from "../../shared/helpers/response";
import { ArticleStatsRepository } from "./article-stats.repo";
import { ArticleStatsService } from "./article-stats.service";

export class ArticleStatsController {

	static async get(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).get(articleId);
		if (!stats) return Res.notFound("Stats not found");
		return Res.ok(stats);
	}

	static async incrementViews(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).incrementViews(articleId);
		return Res.ok(stats);
	}
}
