import { json } from "../../../shared/helpers/json";
import { TagRepository } from "./tags.repo";
import {
	CreateTag,
	DeleteTag,
	GetTagById,
	ListTags,
	ListTagsByArticle,
	ListTagsByProject,
	UpdateTag,
} from "./tags.service";

export class TagsController {
	static async handle(request: Request, env: Env, id?: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const method = request.method;

		// Collection: /v1/api/tags
		if (!id) {
			if (method === "GET") {
				const url = new URL(request.url);
				const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
				const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));				const search = url.searchParams.get("search") ?? undefined;
				const sort = url.searchParams.get("sort") ?? undefined;
				const orderParam = url.searchParams.get("order")?.toLowerCase();
				const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;				const result = await new ListTags(repository).execute({ page, limit });
				return json(result);
			}

			if (method === "POST") {
				const body = await request.json().catch(() => null);
				if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

				const { tag } = body as Record<string, unknown>;
				if (!tag) {
					return json({ error: "tag is required" }, 422);
				}

				const created = await new CreateTag(repository).execute(body as never);
				return json(created, 201);
			}

			return json({ error: "Method Not Allowed" }, 405);
		}

		// Detail: /v1/api/tags/:id
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) {
			return json({ error: "Invalid tag id" }, 400);
		}

		if (method === "GET") {
			const tag = await new GetTagById(repository).execute(numericId);
			if (!tag) return json({ error: "Not Found" }, 404);
			return json(tag);
		}

		if (method === "PUT" || method === "PATCH") {
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

			const tag = await new UpdateTag(repository).execute(numericId, body as never);
			if (!tag) return json({ error: "Not Found" }, 404);
			return json(tag);
		}

		if (method === "DELETE") {
			const deleted = await new DeleteTag(repository).execute(numericId);
			if (!deleted) return json({ error: "Not Found" }, 404);
			return new Response(null, { status: 204 });
		}

		return json({ error: "Method Not Allowed" }, 405);
	}

	static async handleByArticle(request: Request, env: Env, articleId: string): Promise<Response> {
		if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);
		const repository = new TagRepository(env.DB);
		const tags = await new ListTagsByArticle(repository).execute(articleId);
		return json(tags);
	}

	static async handleByProject(request: Request, env: Env, projectId: string): Promise<Response> {
		if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);
		const repository = new TagRepository(env.DB);
		const tags = await new ListTagsByProject(repository).execute(projectId);
		return json(tags);
	}
}
