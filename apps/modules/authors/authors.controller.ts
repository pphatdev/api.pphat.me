import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { AuthorRepository } from "./authors.repo";
import { AuthorService } from "./authors.service";
import { getValidBody, validateRequired } from "../../shared/helpers/request";

export class AuthorsController {

	/**
	 * @description Validates and converts an author ID to numeric format
	 * @param { string } id The author ID string
	 * @returns { number | null } Numeric ID or null if invalid
	 */
	private static validateId(id: string): number | null {
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	/**
	 * @description List all authors
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Paginated list of authors
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new AuthorRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new AuthorService(repository).list(options);
		return Res.ok(result);
	}

	/**
	 * @description Create a new author
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } The created author
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		const c = { req: request } as any; // Shim for Context-based helper
		try {
			const body = await getValidBody<any>(c);
			validateRequired(body, ['name']);

			const author = await new AuthorService(new AuthorRepository(env.DB)).create(body as never);
			return Res.created(author);
		} catch (err) {
			if (err instanceof Response) return err;
			throw err;
		}
	}

	/**
	 * @description Get an author by ID
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The author ID
	 * @returns { Promise<Response> } The author details
	 */
	static async getById(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const repository = new AuthorRepository(env.DB);
		const author = await new AuthorService(repository).getById(numericId);
		if (!author) return Res.notFound();
		return Res.ok(author);
	}

	/**
	 * @description Update an existing author
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The author ID
	 * @returns { Promise<Response> } The updated author
	 */
	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const c = { req: request } as any;
		try {
			const body = await getValidBody<any>(c);
			const author = await new AuthorService(new AuthorRepository(env.DB)).update(numericId, body as never);
			if (!author) return Res.notFound();
			return Res.ok(author);
		} catch (err) {
			if (err instanceof Response) return err;
			throw err;
		}
	}

	/**
	 * @description Delete an author
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id The author ID
	 * @returns { Promise<Response> } No content response
	 */
	static async delete(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = AuthorsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid author id");

		const repository = new AuthorRepository(env.DB);
		const deleted = await new AuthorService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
