import { ArticlesController } from "./articles.controller";

const listPattern = new URLPattern({ pathname: "/v1/api/articles" });
const detailPattern = new URLPattern({ pathname: "/v1/api/articles/:slug" });

export async function matchArticleRoutes(
	request: Request,
	env: Env,
): Promise<Response | null> {
	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		return ArticlesController.handle(request, env, detailMatch.pathname.groups["slug"]);
	}

	if (listPattern.test(request.url)) {
		return ArticlesController.handle(request, env);
	}

	return null;
}
