import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { SkillRepository } from "./skills.repo";
import { SkillService } from "./skills.service";
import { SKILL_LEVELS } from "./skills.interface";

export class SkillsController {

	private static validateId(id: string): number | null {
		const n = Number(id);
		return Number.isInteger(n) && n > 0 ? n : null;
	}

	/**
	 * @description Normalise incoming body: accept camelCase aliases for the
	 * snake_case DB columns. Mutates `body` in place.
	 */
	private static normalizeBody(body: Record<string, unknown>): void {
		const aliases: Array<[camel: string, snake: string]> = [
			['techStackId', 'tech_stack_id'],
			['yearsOfExperience', 'years_of_experience'],
			['sortOrder', 'sort_order'],
		];
		for (const [camel, snake] of aliases) {
			if (body[camel] !== undefined && body[snake] === undefined) {
				body[snake] = body[camel];
			}
			delete body[camel];
		}
	}

	/**
	 * @description Shared validation. `requireCore` makes tech_stack_id mandatory on create.
	 */
	private static validateFields(body: Record<string, unknown>, requireCore: boolean): Response | null {
		if (requireCore) {
			if (typeof body.tech_stack_id !== 'number' || !Number.isInteger(body.tech_stack_id) || (body.tech_stack_id as number) <= 0) {
				return Res.unprocessable("tech_stack_id is required and must be a positive integer");
			}
		} else if (body.tech_stack_id !== undefined) {
			if (typeof body.tech_stack_id !== 'number' || !Number.isInteger(body.tech_stack_id) || (body.tech_stack_id as number) <= 0) {
				return Res.unprocessable("tech_stack_id must be a positive integer");
			}
		}
		if (body.level !== undefined && !SKILL_LEVELS.includes(body.level as never)) {
			return Res.unprocessable(`level must be one of: ${SKILL_LEVELS.join(', ')}`);
		}
		if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}
		if (body.years_of_experience !== undefined && body.years_of_experience !== null && typeof body.years_of_experience !== 'number') {
			return Res.unprocessable("years_of_experience must be a number or null");
		}
		if (body.sort_order !== undefined && (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order))) {
			return Res.unprocessable("sort_order must be an integer");
		}
		return null;
	}

	/**
	 * @description Translate common DB errors to clean HTTP responses.
	 */
	private static handleDbError(err: unknown): Response {
		if (err instanceof Error) {
			if (err.message.includes("UNIQUE constraint failed: skills.tech_stack_id")) {
				return Res.conflict("A skill for that tech stack already exists");
			}
			if (err.message.includes("FOREIGN KEY constraint failed")) {
				return Res.unprocessable("tech_stack_id does not reference an existing tech stack");
			}
		}
		throw err as Error;
	}

	/**
	 * @description List skills (paginated, searchable). Requires auth so the
	 * list lines up with the rest of the admin surface.
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new SkillRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new SkillService(repository).list(options);
		return Res.ok(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		SkillsController.normalizeBody(dto);
		const invalid = SkillsController.validateFields(dto, true);
		if (invalid) return invalid;

		const repository = new SkillRepository(env.DB);
		try {
			const created = await new SkillService(repository).create(dto as never);
			return Res.created(created);
		} catch (err) {
			return SkillsController.handleDbError(err);
		}
	}

	static async getById(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = SkillsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid skill id");

		const repository = new SkillRepository(env.DB);
		const skill = await new SkillService(repository).getById(numericId);
		if (!skill) return Res.notFound();
		return Res.ok(skill);
	}

	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = SkillsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid skill id");

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		SkillsController.normalizeBody(dto);
		const invalid = SkillsController.validateFields(dto, false);
		if (invalid) return invalid;

		const repository = new SkillRepository(env.DB);
		try {
			const updated = await new SkillService(repository).update(numericId, dto as never);
			if (!updated) return Res.notFound();
			return Res.ok(updated);
		} catch (err) {
			return SkillsController.handleDbError(err);
		}
	}

	static async delete(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = SkillsController.validateId(id);
		if (numericId === null) return Res.badRequest("Invalid skill id");

		const repository = new SkillRepository(env.DB);
		const deleted = await new SkillService(repository).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
