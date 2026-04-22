import { Res } from "../../shared/helpers/response";
import { ProjectDetailRepository } from "./project-details.repo";
import { ProjectDetailService } from "./project-details.service";

export class ProjectDetailsController {

	static async get(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const detail = await new ProjectDetailService(repo).get(projectId);
		if (!detail) return Res.notFound();
		return Res.ok(detail);
	}

	static async create(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return Res.created(detail);
	}

	static async update(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return Res.ok(detail);
	}

	static async delete(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const deleted = await new ProjectDetailService(repo).delete(projectId);
		if (!deleted) return Res.notFound();
		return Res.ok({ message: "Deleted successfully" });
	}
}
