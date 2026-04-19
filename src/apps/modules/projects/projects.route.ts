import { ProjectsController } from "./projects.controller";
import { ProjectDetailsController } from "../project-details/project-details.controller";

const listPattern       = new URLPattern({ pathname: "/v1/api/projects" });
const detailPattern     = new URLPattern({ pathname: "/v1/api/projects/:slug" });
const detailsPattern    = new URLPattern({ pathname: "/v1/api/projects/:slug/details" });

export async function matchProjectRoutes(
	request: Request,
	env: Env,
): Promise<Response | null> {
	// Sub-routes (must be matched before the detail pattern)
	const detailsMatch = detailsPattern.exec(request.url);
	if (detailsMatch) {
		const slug = detailsMatch.pathname.groups["slug"]!;
		const project = await env.DB.prepare("SELECT id FROM projects WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!project) return null;
		return ProjectDetailsController.handle(request, env, project.id);
	}

	const slugMatch = detailPattern.exec(request.url);
	if (slugMatch) {
		return ProjectsController.handle(request, env, slugMatch.pathname.groups["slug"]);
	}

	if (listPattern.test(request.url)) {
		return ProjectsController.handle(request, env);
	}

	return null;
}
