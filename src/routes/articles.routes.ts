import { matchArticleRoutes } from "../apps/modules/articles/articles.route";

export async function handleFetch(request: Request, env: Env): Promise<Response> {
	const response = await matchArticleRoutes(request, env);
	if (response) return response;

	return new Response("Not Found", { status: 404 });
}