import { ProjectsController } from "./projects.controller";
import { ProjectDetailsController } from "../project-details/project-details.controller";
import { TagRepository } from "../tags/tags.repo";
import { ListTagsByProject } from "../tags/tags.service";
import { json } from "../../shared/helpers/json";
import { requireAuth } from "../../middlewares/auth.middleware";

const listPattern       = new URLPattern({ pathname: "/v1/api/projects" });
const detailPattern     = new URLPattern({ pathname: "/v1/api/projects/:slug" });
const detailsPattern    = new URLPattern({ pathname: "/v1/api/projects/:slug/details" });
const tagsPattern       = new URLPattern({ pathname: "/v1/api/projects/:slug/tags" });

export async function matchProjectRoutes(
	request: Request,
	env: Env,
): Promise<Response | null> {
	const method = request.method;

	// Sub-routes (must be matched before the detail pattern)
	const detailsMatch = detailsPattern.exec(request.url);
	if (detailsMatch) {
		const authError = await requireAuth(request, env);
		if (authError) return authError;
		const slug = detailsMatch.pathname.groups["slug"]!;
		const project = await env.DB.prepare("SELECT id FROM projects WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!project) return null;
		return ProjectDetailsController.handle(request, env, project.id);
	}

	// Tags by project
	const tagsMatch = tagsPattern.exec(request.url);
	if (tagsMatch) {
		if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);
		const slug = tagsMatch.pathname.groups["slug"]!;
		const project = await env.DB.prepare("SELECT id FROM projects WHERE slug = ?1").bind(slug).first<{ id: string }>();
		if (!project) return json({ error: "Not Found" }, 404);
		const tags = await new ListTagsByProject(new TagRepository(env.DB)).execute(project.id);
		return json(tags);
	}

	const slugMatch = detailPattern.exec(request.url);
	if (slugMatch) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return ProjectsController.handle(request, env, slugMatch.pathname.groups["slug"]);
	}

	if (listPattern.test(request.url)) {
		if (method !== "GET") {
			const authError = await requireAuth(request, env);
			if (authError) return authError;
		}
		return ProjectsController.handle(request, env);
	}

	return null;
}
