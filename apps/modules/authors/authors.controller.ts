import { Res } from "../../shared/helpers/response";
import { AuthorRepository } from "./authors.repo";
import { AuthorService } from "./authors.service";

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
		const sortParam = url.searchParams.get("sort");
		const sort = sortParam ? sortParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
		const orderParam = url.searchParams.get("order")?.toLowerCase();
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const result = await new AuthorService(repository).list({ page, limit, search, sort, order });
		return Res.ok(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new AuthorRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const { name } = body as Record<string, unknown>;
		if (!name) {
			return Res.unprocessable("name is required");
		}

		const author = await new AuthorService(repository).create(body as never);
		return Res.created(author);
	}

	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const repository = new AuthorRepository(env.DB);
		const author = await new AuthorService(repository).getById(numericId);
		if (!author) return Res.notFound();
		return Res.ok(author);
	}

	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const repository = new AuthorRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const author = await new AuthorService(repository).update(numericId, body as never);
		if (!author) return Res.notFound();
		return Res.ok(author);
	}

	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const repository = new AuthorRepository(env.DB);
		const deleted = await new AuthorService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
