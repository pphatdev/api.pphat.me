import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { TagRepository } from "./tags.repo";
import { TagService } from "./tags.service";

export class TagsController {

	private static validateId(id: string): number | null {
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new TagService(repository).list(options);
		return Res.ok(result);
	}

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

	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tag id");

		const repository = new TagRepository(env.DB);
		const tag = await new TagService(repository).getById(numericId);
		if (!tag) return Res.notFound();
		return Res.ok(tag);
	}

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

	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tag id");

		const repository = new TagRepository(env.DB);
		const deleted = await new TagService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}

	static async listByArticle(request: Request, env: Env, articleId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByArticle(articleId);
		return Res.ok(tags);
	}

	static async listByProject(request: Request, env: Env, projectId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByProject(projectId);
		return Res.ok(tags);
	}
}
