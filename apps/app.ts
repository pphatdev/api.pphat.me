import { matchArticleRoutes } from "./modules/articles/articles.route";
import { matchProjectRoutes } from "./modules/projects/projects.route";
import { matchAuthRoutes } from "./modules/auth/auth.route";
import { matchAuthorRoutes } from "./modules/authors/authors.routes";
import { matchTagRoutes } from "./modules/tags/tags.routes";
import { json } from "./shared/helpers/json";
import { applyApiTypeRateLimit, attachRateLimitHeaders } from "./middlewares/rate-limit.middleware";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const rateLimit = applyApiTypeRateLimit(request);
		if (rateLimit.response) return rateLimit.response;

		const response =
			(await matchAuthRoutes(request, env)) ??
			(await matchArticleRoutes(request, env)) ??
			(await matchProjectRoutes(request, env)) ??
			(await matchAuthorRoutes(request, env)) ??
			(await matchTagRoutes(request, env));
		const finalResponse = response ?? json({ error: "Not Found" }, 404);
		return attachRateLimitHeaders(finalResponse, rateLimit.headers);
	},
} satisfies ExportedHandler<Env>;
