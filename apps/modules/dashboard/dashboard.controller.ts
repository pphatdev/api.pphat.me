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
	 * @description Returns standard dashboard initialization data
	 * @method GET
	 * @param { Context } c Hono context
	 * @returns { Promise<Response> } Dashboard data
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
	 * @description Streams live traffic data using SSE.
	 * The loop honours client aborts (browser closes tab, network drop) and enforces
	 * a hard maximum duration so a stuck connection cannot burn CPU / DB / billing
	 * indefinitely. Clients that need longer streams must reconnect.
	 * @method GET
	 * @param { Context } c Hono context
	 * @returns { Promise<Response> } SSE stream
	 */
	static async streamLiveTraffic(c: Context<{ Bindings: Env }>): Promise<Response> {
		const db = c.env.DB;
		const articleRepo = new ArticleRepository(db);
		const projectRepo = new ProjectRepository(db);
		const authorRepo = new AuthorRepository(db);
		const repo = new DashboardRepository(db, articleRepo, projectRepo, authorRepo);

		const POLL_INTERVAL_MS = 5000;
		const MAX_STREAM_DURATION_MS = 10 * 60 * 1000; // 10 min hard cap; client reconnects
		const signal = c.req.raw.signal;

		return streamSSE(c, async (stream) => {
			const deadline = Date.now() + MAX_STREAM_DURATION_MS;
			let lastCount = -1;

			while (!signal.aborted && !stream.aborted && !stream.closed && Date.now() < deadline) {
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

				await abortableSleep(POLL_INTERVAL_MS, signal, stream);
			}
		});
	}
}

/**
 * @description Sleep that resolves early on request abort / stream close
 * @param { number } ms Sleep duration in milliseconds
 * @param { AbortSignal } signal The request's abort signal
 * @param { { aborted?: boolean; closed?: boolean } } stream The SSE stream handle
 * @returns { Promise<void> }
 */
function abortableSleep(
	ms: number,
	signal: AbortSignal,
	stream: { aborted?: boolean; closed?: boolean },
): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted || stream.aborted || stream.closed) return resolve();
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', onAbort);
			resolve();
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
}
