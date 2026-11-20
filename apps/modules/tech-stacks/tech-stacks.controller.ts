import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { TechStackRepository } from "./tech-stacks.repo";
import { TechStackService } from "./tech-stacks.service";

export class TechStacksController {

	/**
	 * @description Validate a stringified numeric id
	 * @param { string } id Raw id param
	 * @returns { number | null } Numeric id or null when invalid
	 */
	private static validateId(id: string): number | null {
		const n = Number(id);
		return Number.isInteger(n) && n > 0 ? n : null;
	}

	/**
	 * @description Normalise incoming body: accept `logoUrl` as an alias for
	 * `logo_url` so clients can send either convention. Mutates `body` in place.
	 * @param { Record<string, unknown> } body Request body
	 * @returns { void }
	 */
	private static normalizeBody(body: Record<string, unknown>): void {
		if (body.logoUrl !== undefined && body.logo_url === undefined) {
			body.logo_url = body.logoUrl;
		}
		delete body.logoUrl;
	}

	/**
	 * @description List tech stacks (paginated, searchable).
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Paginated list
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new TechStackRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new TechStackService(repository).list(options);
		return Res.ok(result);
	}

	/**
	 * @description Create a tech stack. Admin only.
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } 201 with the created row
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		TechStacksController.normalizeBody(dto);

		if (typeof dto.name !== 'string' || dto.name.trim() === '') {
			return Res.unprocessable("name is required");
		}
		if (dto.status !== undefined && dto.status !== 0 && dto.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}

		const repository = new TechStackRepository(env.DB);
		const created = await new TechStackService(repository).create(dto as never);
		return Res.created(created);
	}

	/**
	 * @description Get a tech stack by id.
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 200 or 404
	 */
	static async getById(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TechStacksController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tech stack id");

		const repository = new TechStackRepository(env.DB);
		const stack = await new TechStackService(repository).getById(numericId);
		if (!stack) return Res.notFound();
		return Res.ok(stack);
	}

	/**
	 * @description Update a tech stack. Admin only. Partial.
	 * @method PUT/PATCH
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 200 or 404
	 */
	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TechStacksController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tech stack id");

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		TechStacksController.normalizeBody(dto);

		if (dto.status !== undefined && dto.status !== 0 && dto.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}

		const repository = new TechStackRepository(env.DB);
		const updated = await new TechStackService(repository).update(numericId, dto as never);
		if (!updated) return Res.notFound();
		return Res.ok(updated);
	}

	/**
	 * @description Delete a tech stack. Admin only.
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 204 or 404
	 */
	static async delete(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = TechStacksController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid tech stack id");

		const repository = new TechStackRepository(env.DB);
		const deleted = await new TechStackService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
