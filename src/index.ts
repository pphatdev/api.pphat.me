import { matchArticleRoutes } from "./apps/modules/articles/articles.route";
import { matchProjectRoutes } from "./apps/modules/projects/projects.route";
import { matchAuthRoutes } from "./apps/modules/auth/auth.route";
import { matchAuthorRoutes } from "./routes/authors.routes";
import { matchTagRoutes } from "./routes/tags.routes";
import { json } from "./shared/helpers/json";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const response =
			(await matchAuthRoutes(request, env)) ??
			(await matchArticleRoutes(request, env)) ??
			(await matchProjectRoutes(request, env)) ??
			(await matchAuthorRoutes(request, env)) ??
			(await matchTagRoutes(request, env));
		return response ?? json({ error: "Not Found" }, 404);
	},
} satisfies ExportedHandler<Env>;
