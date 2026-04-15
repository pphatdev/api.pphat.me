import { TagsController } from "../apps/modules/tags/tags.controller";

const listPattern = new URLPattern({ pathname: "/v1/api/tags" });
const detailPattern = new URLPattern({ pathname: "/v1/api/tags/:id" });

export async function matchTagRoutes(request: Request, env: Env): Promise<Response | null> {
	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		return TagsController.handle(request, env, detailMatch.pathname.groups["id"]);
	}
	if (listPattern.test(request.url)) {
		return TagsController.handle(request, env);
	}
	return null;
}
