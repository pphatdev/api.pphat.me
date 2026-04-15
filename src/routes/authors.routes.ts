import { AuthorsController } from "../apps/modules/authors/authors.controller";

const listPattern = new URLPattern({ pathname: "/v1/api/authors" });
const detailPattern = new URLPattern({ pathname: "/v1/api/authors/:id" });

export async function matchAuthorRoutes(request: Request, env: Env): Promise<Response | null> {
	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		return AuthorsController.handle(request, env, detailMatch.pathname.groups["id"]);
	}
	if (listPattern.test(request.url)) {
		return AuthorsController.handle(request, env);
	}
	return null;
}
