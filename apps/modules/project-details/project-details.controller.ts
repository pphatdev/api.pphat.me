import { json } from "../../shared/helpers/json";
import { ProjectDetailRepository } from "./project-details.repo";
import { ProjectDetailService } from "./project-details.service";

export class ProjectDetailsController {

	static async get(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const detail = await new ProjectDetailService(repo).get(projectId);
		if (!detail) return json({ error: "Not Found" }, 404);
		return json(detail);
	}

	static async create(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return json(detail, 201);
	}

	static async update(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return json(detail);
	}

	static async delete(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const deleted = await new ProjectDetailService(repo).delete(projectId);
		if (!deleted) return json({ error: "Not Found" }, 404);
		return json({ message: "Deleted successfully" });
	}
}
