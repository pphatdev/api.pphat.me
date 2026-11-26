import { Res } from "../../shared/helpers/response";
import type { JwtPayload } from "../auth/auth.interface";
import { ArticleStatsRepository } from "./article-stats.repo";
import { ArticleStatsService } from "./article-stats.service";
import { getClientIp } from "../../shared/helpers/client-ip";
import { hmacHex } from "../../shared/helpers/hash";

/**
 * User agents that should never count as a reader: crawlers, link-preview
 * fetchers, headless browsers and generic HTTP clients.
 */
const BOT_UA = /bot|crawl|spider|slurp|archiver|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|headless|lighthouse|phantom|puppeteer|playwright|curl|wget|python|httpclient|axios|node-fetch|undici|okhttp|go-http|java\//i;

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
	 * @description Increment view count for an article. Signed-in callers are
	 * deduped per user per day; anonymous readers per visitor hash per day.
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } The updated stats
	 */
	static async incrementViews(request: Request, env: Env, articleId: string, user: JwtPayload | undefined): Promise<Response> {
		const service = new ArticleStatsService(new ArticleStatsRepository(env.DB));
		if (user) {
			const stats = await service.incrementViews(articleId, user.sub);
			return Res.ok(stats);
		}
		return ArticleStatsController.incrementAnonymousViews(request, env, articleId, service);
	}

	/**
	 * @description Count a view from an anonymous reader (e.g. the public blog).
	 * Only published, public articles count; bots and requests without a user
	 * agent are answered with the current stats and `counted: false`.
	 * The reader is identified by HMAC(secret, day|article|ip|ua): no raw IP is
	 * stored and hashes cannot be linked across days or articles.
	 */
	private static async incrementAnonymousViews(
		request: Request,
		env: Env,
		articleId: string,
		service: ArticleStatsService,
	): Promise<Response> {
		const article = await env.DB
			.prepare("SELECT 1 AS ok FROM articles WHERE id = ?1 AND published = 1 AND is_public = 1")
			.bind(articleId)
			.first<{ ok: number }>();
		if (!article) return Res.notFound();

		const ua = request.headers.get('user-agent')?.trim() ?? '';
		// Cloudflare always sets CF-Connecting-IP in production; `wrangler dev`
		// does not. Fall back to a shared bucket (as trafficMiddleware does) so
		// local dev still counts, deduped by user agent per day.
		const ip = getClientIp(request, env.ADMIN_PROXY_SECRET) ?? 'unknown';
		if (!ua || BOT_UA.test(ua)) {
			const stats = (await service.get(articleId)) ?? { articleId, views: 0, readingMins: 0 };
			return Res.ok({ ...stats, counted: false });
		}

		const day = new Date().toISOString().slice(0, 10);
		const secret = env.IP_HASH_SECRET || env.JWT_SECRET;
		const visitorHash = await hmacHex(secret, `view|${day}|${articleId}|${ip}|${ua}`);
		return Res.ok(await service.incrementVisitorViews(articleId, visitorHash));
	}
}
