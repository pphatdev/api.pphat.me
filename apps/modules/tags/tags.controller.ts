import { json } from "../../shared/helpers/json";
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
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search = url.searchParams.get("search") ?? undefined;
		const sort = url.searchParams.get("sort") ?? undefined;
		const orderParam = url.searchParams.get("order")?.toLowerCase();
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const result = await new TagService(repository).list({ page, limit, search, sort, order });
		return json(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const { tag } = body as Record<string, unknown>;
		if (!tag) {
			return json({ error: "tag is required" }, 422);
		}

		const created = await new TagService(repository).create(body as never);
		return json(created, 201);
	}

	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid tag id" }, 400);

		const repository = new TagRepository(env.DB);
		const tag = await new TagService(repository).getById(numericId);
		if (!tag) return json({ error: "Not Found" }, 404);
		return json(tag);
	}

	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid tag id" }, 400);

		const repository = new TagRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const tag = await new TagService(repository).update(numericId, body as never);
		if (!tag) return json({ error: "Not Found" }, 404);
		return json(tag);
	}

	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TagsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid tag id" }, 400);

		const repository = new TagRepository(env.DB);
		const deleted = await new TagService(repository).delete(numericId);
		if (!deleted) return json({ error: "Not Found" }, 404);
		return new Response(null, { status: 204 });
	}

	static async listByArticle(request: Request, env: Env, articleId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByArticle(articleId);
		return json(tags);
	}

	static async listByProject(request: Request, env: Env, projectId: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const tags = await new TagService(repository).listByProject(projectId);
		return json(tags);
	}
}
