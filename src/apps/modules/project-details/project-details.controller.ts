import { json } from "../../../shared/helpers/json";
import { ProjectDetailRepository } from "./project-details.repo";
import { DeleteProjectDetail, GetProjectDetail, UpsertProjectDetail } from "./project-details.service";

export class ProjectDetailsController {
	static async handle(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const method = request.method;

		// GET /v1/api/projects/:slug/details
		if (method === "GET") {
			const detail = await new GetProjectDetail(repo).execute(projectId);
			if (!detail) return json({ error: "Not Found" }, 404);
			return json(detail);
		}

		// POST /v1/api/projects/:slug/details  — create or replace
		// PATCH /v1/api/projects/:slug/details — partial update
		if (method === "POST" || method === "PATCH") {
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
			const detail = await new UpsertProjectDetail(repo).execute(projectId, body as never);
			return json(detail, method === "POST" ? 201 : 200);
		}

		// DELETE /v1/api/projects/:slug/details
		if (method === "DELETE") {
			const deleted = await new DeleteProjectDetail(repo).execute(projectId);
			if (!deleted) return json({ error: "Not Found" }, 404);
			return json({ message: "Deleted successfully" });
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
