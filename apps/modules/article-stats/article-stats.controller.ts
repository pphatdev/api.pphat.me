import { json } from "../../shared/helpers/json";
import { ArticleStatsRepository } from "./article-stats.repo";
import { ArticleStatsService } from "./article-stats.service";

export class ArticleStatsController {

	static async get(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).get(articleId);
		if (!stats) return json({ error: "Stats not found" }, 404);
		return json(stats);
	}

	static async incrementViews(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const stats = await new ArticleStatsService(repo).incrementViews(articleId);
		return json(stats);
	}
}
