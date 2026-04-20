import { json } from "../../shared/helpers/json";
import { AuthorRepository } from "./authors.repo";
import {
	CreateAuthor,
	DeleteAuthor,
	GetAuthorById,
	ListAuthors,
	UpdateAuthor,
} from "./authors.service";

export class AuthorsController {

	private static validateId(id: string): number | null {
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new AuthorRepository(env.DB);
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search = url.searchParams.get("search") ?? undefined;
		const sort = url.searchParams.get("sort") ?? undefined;
		const orderParam = url.searchParams.get("order")?.toLowerCase();
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const result = await new ListAuthors(repository).execute({ page, limit, search, sort, order });
		return json(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new AuthorRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const { name } = body as Record<string, unknown>;
		if (!name) {
			return json({ error: "name is required" }, 422);
		}

		const author = await new CreateAuthor(repository).execute(body as never);
		return json(author, 201);
	}

	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid author id" }, 400);

		const repository = new AuthorRepository(env.DB);
		const author = await new GetAuthorById(repository).execute(numericId);
		if (!author) return json({ error: "Not Found" }, 404);
		return json(author);
	}

	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid author id" }, 400);

		const repository = new AuthorRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const author = await new UpdateAuthor(repository).execute(numericId, body as never);
		if (!author) return json({ error: "Not Found" }, 404);
		return json(author);
	}

	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return json({ error: "Invalid author id" }, 400);

		const repository = new AuthorRepository(env.DB);
		const deleted = await new DeleteAuthor(repository).execute(numericId);
		if (!deleted) return json({ error: "Not Found" }, 404);
		return new Response(null, { status: 204 });
	}
}
