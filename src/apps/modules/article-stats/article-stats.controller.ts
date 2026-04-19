import { json } from "../../../shared/helpers/json";
import { ArticleStatsRepository } from "./article-stats.repo";
import { GetArticleStats, IncrementArticleViews } from "./article-stats.service";

export class ArticleStatsController {
	static async handle(request: Request, env: Env, articleId: string, action?: string): Promise<Response> {
		const repo = new ArticleStatsRepository(env.DB);
		const method = request.method;

		// POST /v1/api/articles/:slug/stats/view
		if (action === "view") {
			if (method !== "POST") return json({ error: "Method Not Allowed" }, 405);
			const stats = await new IncrementArticleViews(repo).execute(articleId);
			return json(stats);
		}

		// GET /v1/api/articles/:slug/stats
		if (method === "GET") {
			const stats = await new GetArticleStats(repo).execute(articleId);
			if (!stats) return json({ error: "Stats not found" }, 404);
			return json(stats);
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
