import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { TagRepository } from "./tags.repo";
import { TagService } from "./tags.service";

export class TagsController {

	/**
	 * @description Validates and converts a tag ID to numeric format
	 * @param { string } id The tag ID string
	 * @returns { number | null } Numeric ID or null if invalid
	 */
	private static validateId(id: string): number | null {
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	/**
	 * @description List all tags
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Paginated list of tags
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new TagService(repository).list(options);
		return Res.ok(result);
	}

	/**
	 * @description Create a new tag
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } The created tag
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const { tag } = body as Record<string, unknown>;
		if (!tag) {
			return Res.unprocessable("tag is required");
		}

		const created = await new TagService(repository).create(body as never);
		return Res.created(created);
	}

	/**
	 * @description Get a tag by ID
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The tag ID
	 * @returns { Promise<Response> } The tag details
	 */
	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tag id");

		const repository = new TagRepository(env.DB);
		const tag = await new TagService(repository).getById(numericId);
		if (!tag) return Res.notFound();
		return Res.ok(tag);
	}

	/**
	 * @description Update an existing tag
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The tag ID
	 * @returns { Promise<Response> } The updated tag
	 */
	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tag id");

		const repository = new TagRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const tag = await new TagService(repository).update(numericId, body as never);
		if (!tag) return Res.notFound();
		return Res.ok(tag);
	}

	/**
	 * @description Delete a tag
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The tag ID
	 * @returns { Promise<Response> } No content response
	 */
	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tag id");

		const repository = new TagRepository(env.DB);
		const deleted = await new TagService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}

	/**
	 * @description List tags by article ID
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article UUID
	 * @returns { Promise<Response> } List of tags
	 */
	static async listByArticle(request: Request, env: Env, articleId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByArticle(articleId);
		return Res.ok(tags);
	}

	/**
	 * @description List tags by project ID
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Response> } List of tags
	 */
	static async listByProject(request: Request, env: Env, projectId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByProject(projectId);
		return Res.ok(tags);
	}
}
