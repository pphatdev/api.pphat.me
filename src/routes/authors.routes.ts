import { AuthorsController } from "../apps/modules/authors/authors.controller";
import { requireAuth } from "../shared/helpers/auth-middleware";

const listPattern = new URLPattern({ pathname: "/v1/api/authors" });
const detailPattern = new URLPattern({ pathname: "/v1/api/authors/:id" });

export async function matchAuthorRoutes(request: Request, env: Env): Promise<Response | null> {
	const method = request.method;

	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return AuthorsController.handle(request, env, detailMatch.pathname.groups["id"]);
	}
	if (listPattern.test(request.url)) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return AuthorsController.handle(request, env);
	}
	return null;
}
