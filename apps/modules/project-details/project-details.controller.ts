import { Res } from "../../shared/helpers/response";
import { ProjectDetailRepository } from "./project-details.repo";
import { ProjectDetailService } from "./project-details.service";

export class ProjectDetailsController {

	/**
	 * @description Get project details by project ID
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Response> } The project details
	 */
	static async get(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const detail = await new ProjectDetailService(repo).get(projectId);
		if (!detail) return Res.notFound();
		return Res.ok(detail);
	}

	/**
	 * @description Create details for a project
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Response> } The created details
	 */
	static async create(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return Res.created(detail);
	}

	/**
	 * @description Update details for a project
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Response> } The updated details
	 */
	static async update(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const detail = await new ProjectDetailService(repo).upsert(projectId, body as never);
		return Res.ok(detail);
	}

	/**
	 * @description Delete details for a project
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Response> } Success message
	 */
	static async delete(request: Request, env: Env, projectId: string): Promise<Response> {
		const repo = new ProjectDetailRepository(env.DB);
		const deleted = await new ProjectDetailService(repo).delete(projectId);
		if (!deleted) return Res.notFound();
		return Res.ok({ message: "Deleted successfully" });
	}
}
