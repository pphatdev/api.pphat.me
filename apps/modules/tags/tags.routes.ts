import { TagsController } from "./tags.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const listPattern = new URLPattern({ pathname: "/v1/api/tags" });
const detailPattern = new URLPattern({ pathname: "/v1/api/tags/:id" });

export async function matchTagRoutes(request: Request, env: Env): Promise<Response | null> {
	const method = request.method;

	const detailMatch = detailPattern.exec(request.url);
	if (detailMatch) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return TagsController.handle(request, env, detailMatch.pathname.groups["id"]);
	}
	if (listPattern.test(request.url)) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return TagsController.handle(request, env);
	}
	return null;
}
