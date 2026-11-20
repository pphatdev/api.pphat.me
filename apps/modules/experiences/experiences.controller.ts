import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { ExperienceRepository } from "./experiences.repo";
import { ExperienceService } from "./experiences.service";
import { EMPLOYMENT_TYPES } from "./experiences.interface";

export class ExperiencesController {

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
	 * @description Normalise incoming body: accept camelCase aliases for the
	 * snake_case DB columns so clients can send either convention. Mutates
	 * `body` in place.
	 * @param { Record<string, unknown> } body Request body
	 * @returns { void }
	 */
	private static normalizeBody(body: Record<string, unknown>): void {
		const aliases: Array<[camel: string, snake: string]> = [
			['startDate', 'start_date'],
			['endDate', 'end_date'],
			['employmentType', 'employment_type'],
			['companyUrl', 'company_url'],
			['logoUrl', 'logo_url'],
		];
		for (const [camel, snake] of aliases) {
			if (body[camel] !== undefined && body[snake] === undefined) {
				body[snake] = body[camel];
			}
			delete body[camel];
		}
	}

	/**
	 * @description Shared field validation used by both create and update.
	 * Returns a Response when invalid, null otherwise. Create vs update
	 * differs only in which fields are required — `requireCore` forces
	 * title / company / start_date.
	 * @param { Record<string, unknown> } body Normalised body
	 * @param { boolean } requireCore When true, title / company / start_date must be present
	 * @returns { Response | null } Error response if invalid, null otherwise
	 */
	private static validateFields(body: Record<string, unknown>, requireCore: boolean): Response | null {
		if (requireCore) {
			if (typeof body.title !== 'string' || body.title.trim() === '') return Res.unprocessable("title is required");
			if (typeof body.company !== 'string' || body.company.trim() === '') return Res.unprocessable("company is required");
			if (typeof body.start_date !== 'string' || body.start_date.trim() === '') return Res.unprocessable("start_date is required");
		}
		if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}
		if (body.employment_type !== undefined && !EMPLOYMENT_TYPES.includes(body.employment_type as never)) {
			return Res.unprocessable(`employment_type must be one of: ${EMPLOYMENT_TYPES.join(', ')}`);
		}
		return null;
	}

	/**
	 * @description List experiences (paginated, searchable, timeline-ordered by default).
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } Paginated list
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new ExperienceRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new ExperienceService(repository).list(options);
		return Res.ok(result);
	}

	/**
	 * @description Create an experience. Admin only.
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } 201 with the created row
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		ExperiencesController.normalizeBody(dto);
		const invalid = ExperiencesController.validateFields(dto, true);
		if (invalid) return invalid;

		const repository = new ExperienceRepository(env.DB);
		const created = await new ExperienceService(repository).create(dto as never);
		return Res.created(created);
	}

	/**
	 * @description Get an experience by id.
	 * @method GET
	 * @param { Request } _request The incoming request (unused)
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 200 or 404
	 */
	static async getById(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");

		const repository = new ExperienceRepository(env.DB);
		const exp = await new ExperienceService(repository).getById(numericId);
		if (!exp) return Res.notFound();
		return Res.ok(exp);
	}

	/**
	 * @description Update an experience. Admin only. Partial.
	 * @method PUT/PATCH
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 200 or 404
	 */
	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		ExperiencesController.normalizeBody(dto);
		const invalid = ExperiencesController.validateFields(dto, false);
		if (invalid) return invalid;

		const repository = new ExperienceRepository(env.DB);
		const updated = await new ExperienceService(repository).update(numericId, dto as never);
		if (!updated) return Res.notFound();
		return Res.ok(updated);
	}

	/**
	 * @description Delete an experience. Admin only.
	 * @method DELETE
	 * @param { Request } _request The incoming request (unused)
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw id param
	 * @returns { Promise<Response> } 204 or 404
	 */
	static async delete(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");

		const repository = new ExperienceRepository(env.DB);
		const deleted = await new ExperienceService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}

	/**
	 * @description Resume timeline — experiences grouped by company with
	 * roles/skills nested. Public: the whole point is a shareable resume view.
	 * Supports `?page=` + `?limit=` for standard pagination; the unit is a
	 * company (not an experience) so a page always contains fully-populated
	 * companies rather than splitting roles across pages.
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } 200 with { data, pagination }
	 */
	static async timeline(request: Request, env: Env): Promise<Response> {
		const repository = new ExperienceRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new ExperienceService(repository).getTimeline(options);
		return Res.ok(result);
	}

	/**
	 * @description Replace the full set of skills (tech stacks) linked to an
	 * experience. Body: `{ tech_stack_ids: number[] }` (or `techStackIds`).
	 * Admin only.
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw experience id
	 * @returns { Promise<Response> } 204 on success, 404 if experience is unknown
	 */
	static async setSkills(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const raw = (body as any).tech_stack_ids ?? (body as any).techStackIds;
		if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'number' || !Number.isInteger(v))) {
			return Res.unprocessable("tech_stack_ids must be an array of integers");
		}

		const repository = new ExperienceRepository(env.DB);
		const service = new ExperienceService(repository);
		const existing = await service.getById(numericId);
		if (!existing) return Res.notFound();

		await service.setSkills(numericId, raw as number[]);
		return Res.noContent();
	}

	/**
	 * @description Attach a single tech stack to an experience. Idempotent —
	 * returns 200 whether the link already existed or was newly created.
	 * @method POST
	 * @param { Request } _request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw experience id
	 * @param { string } techStackId Raw tech-stack id
	 * @returns { Promise<Response> } 200 with { attached: boolean }
	 */
	static async attachSkill(_request: Request, env: Env, id: string, techStackId: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");
		const numericTsId = ExperiencesController.validateId(techStackId);
		if (numericTsId === null) return Res.badRequest("Invalid tech stack id");

		const repository = new ExperienceRepository(env.DB);
		const service = new ExperienceService(repository);
		if (!(await service.getById(numericId))) return Res.notFound();

		const attached = await service.attachSkill(numericId, numericTsId);
		return Res.ok({ attached });
	}

	/**
	 * @description Detach a single tech stack from an experience.
	 * @method DELETE
	 * @param { Request } _request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } id Raw experience id
	 * @param { string } techStackId Raw tech-stack id
	 * @returns { Promise<Response> } 204 or 404 when the link did not exist
	 */
	static async detachSkill(_request: Request, env: Env, id: string, techStackId: string): Promise<Response> {
		const numericId = ExperiencesController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid experience id");
		const numericTsId = ExperiencesController.validateId(techStackId);
		if (numericTsId === null) return Res.badRequest("Invalid tech stack id");

		const repository = new ExperienceRepository(env.DB);
		const removed = await new ExperienceService(repository).detachSkill(numericId, numericTsId);
		if (!removed) return Res.notFound();
		return Res.noContent();
	}
}
