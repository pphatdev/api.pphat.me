import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Res } from "../../shared/helpers/response";
import { DashboardRepository } from "./dashboard.repo";
import { DashboardService } from "./dashboard.service";
import { ArticleRepository } from "../articles/articles.repo";
import { ProjectRepository } from "../projects/projects.repo";
import { AuthorRepository } from "../authors/authors.repo";

export class DashboardController {
	/**
	 * Returns standard dashboard initialization data (JSON).
	 */
	static async getInitData(c: Context<{ Bindings: Env }>): Promise<Response> {
		const db = c.env.DB;

		const articleRepo = new ArticleRepository(db);
		const projectRepo = new ProjectRepository(db);
		const authorRepo = new AuthorRepository(db);

		const repo = new DashboardRepository(db, articleRepo, projectRepo, authorRepo);
		const service = new DashboardService(repo);

		const data = await service.getDashboardInitData();
		return Res.ok(data);
	}

	/**
	 * Streams live traffic data using SSE (polling D1 every 5s)
	 */
	static async streamLiveTraffic(c: Context<{ Bindings: Env }>): Promise<Response> {
		const db = c.env.DB;
		const articleRepo = new ArticleRepository(db);
		const projectRepo = new ProjectRepository(db);
		const authorRepo = new AuthorRepository(db);
		const repo = new DashboardRepository(db, articleRepo, projectRepo, authorRepo);

		return streamSSE(c, async (stream) => {
			let lastCount = -1;

			while (true) {
				try {
					const currentCount = await repo.getLiveTraffic();

					if (currentCount !== lastCount) {
						lastCount = currentCount;
						await stream.writeSSE({
							data: JSON.stringify({ liveTraffic: currentCount })
						});
					}
				} catch (err) {
					console.error("Live traffic stream error:", err);
				}

				// Wait 5 seconds before next poll
				await new Promise(r => setTimeout(r, 5000));
			}
		});
	}
}
