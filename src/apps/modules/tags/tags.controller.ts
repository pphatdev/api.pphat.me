import { json } from "../../../shared/helpers/json";
import { TagRepository } from "./tags.repo";
import {
	CreateTag,
	DeleteTag,
	GetTagById,
	ListTags,
	UpdateTag,
} from "./tags.service";

export class TagsController {
	static async handle(request: Request, env: Env, id?: string): Promise<Response> {
		const repository = new TagRepository(env.DB);
		const method = request.method;

		// Collection: /v1/api/tags
		if (!id) {
			if (method === "GET") {
				const tags = await new ListTags(repository).execute();
				return json(tags);
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
}
