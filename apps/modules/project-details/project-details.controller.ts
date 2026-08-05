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
}
