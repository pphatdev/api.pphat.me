import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { AboutMeRepository } from "./about-me.repo";
import { AboutMeService } from "./about-me.service";
import type { CreateAboutMeDto, UpdateAboutMeDto } from "./about-me.interface";

export class AboutMeController {

	public static validateId(id: string): number | null {
		const n = Number(id);
		return Number.isInteger(n) && n > 0 ? n : null;
	}

	/**
	 * @description Normalise incoming body: accept camelCase and intuitive aliases
	 * for snake_case columns. Mutates `body` in place.
	 */
	private static normalizeBody(body: Record<string, unknown>): void {
		const aliases: Array<[alias: string, target: string]> = [
			['buttonText', 'button_text'],
			['buttonUrl', 'button_url'],
			['actionText', 'button_text'],
			['actionUrl', 'button_url'],
			['sortOrder', 'sort_order'],
			['position', 'sort_order'],
			['sequence', 'sort_order'],
			['label', 'badge'],
		];
		for (const [alias, target] of aliases) {
			if (body[alias] !== undefined && body[target] === undefined) {
				body[target] = body[alias];
			}
			delete body[alias];
		}

		// Content/bio aliases for description
		if (body.content !== undefined && body.description === undefined) {
			body.description = body.content;
		}
		if (body.bio !== undefined && body.description === undefined) {
			body.description = body.bio;
		}
		if (body.about !== undefined && body.description === undefined) {
			body.description = body.about;
		}
		delete body.content;
		delete body.bio;
		delete body.about;
	}

	/**
	 * @description Validation for About Me body.
	 */
	private static validateFields(body: Record<string, unknown>, isCreate: boolean): Response | null {
		if (isCreate) {
			if (typeof body.title !== 'string' || !body.title.trim()) {
				return Res.unprocessable("title is required and must be a non-empty string");
			}
			if (typeof body.description !== 'string' || !body.description.trim()) {
				return Res.unprocessable("description (or content/bio) is required and must be a non-empty string");
			}
		} else {
			if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
				return Res.unprocessable("title must be a non-empty string");
			}
			if (body.description !== undefined && (typeof body.description !== 'string' || !body.description.trim())) {
				return Res.unprocessable("description must be a non-empty string");
			}
		}

		if (body.badge !== undefined && typeof body.badge !== 'string') {
			return Res.unprocessable("badge must be a string");
		}
		if (body.button_text !== undefined && typeof body.button_text !== 'string') {
			return Res.unprocessable("button_text must be a string");
		}
		if (body.button_url !== undefined && typeof body.button_url !== 'string') {
			return Res.unprocessable("button_url must be a string");
		}
		if (body.name !== undefined && typeof body.name !== 'string') {
			return Res.unprocessable("name must be a string");
		}
		if (body.nickname !== undefined && typeof body.nickname !== 'string') {
			return Res.unprocessable("nickname must be a string");
		}
		if (body.role !== undefined && typeof body.role !== 'string') {
			return Res.unprocessable("role must be a string");
		}
		if (body.location !== undefined && typeof body.location !== 'string') {
			return Res.unprocessable("location must be a string");
		}
		if (body.images !== undefined) {
			if (!Array.isArray(body.images) || body.images.some(img => typeof img !== 'string')) {
				return Res.unprocessable("images must be an array of string URLs");
			}
		}
		if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}
		if (body.sort_order !== undefined && (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order))) {
			return Res.unprocessable("sort_order must be an integer");
		}
		return null;
	}

	/**
	 * @description Get active About Me profile for public presentation.
	 */
	static async getActive(_request: Request, env: Env): Promise<Response> {
		const repository = new AboutMeRepository(env.DB);
		const active = await new AboutMeService(repository).getActive();
		if (!active) {
			return Res.notFound("Active About Me profile not found");
		}
		return Res.ok(active);
	}

	/**
	 * @description List About Me profiles. Public callers only see status=1 (active).
	 * Admins can see all profiles or filter by status.
	 */
	static async list(request: Request, env: Env, isAdmin: boolean): Promise<Response> {
		const repository = new AboutMeRepository(env.DB);
		const options = parseListParams(request.url);
		const url = new URL(request.url);
		const status = url.searchParams.get("status")?.trim() || undefined;

		const result = await new AboutMeService(repository).list({
			...options,
			status,
			onlyActive: !isAdmin,
		});
		return Res.ok(result);
	}

	/**
	 * @description Get About Me profile by numeric ID.
	 */
	static async getById(_request: Request, env: Env, idStr: string, isAdmin: boolean): Promise<Response> {
		const id = AboutMeController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new AboutMeRepository(env.DB);
		const profile = await new AboutMeService(repository).getById(id);
		if (!profile) {
			return Res.notFound("About Me profile not found");
		}

		if (profile.status === 0 && !isAdmin) {
			return Res.notFound("About Me profile not found");
		}

		return Res.ok(profile);
	}

	/**
	 * @description Create About Me profile (admin only).
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		AboutMeController.normalizeBody(body);
		const validationError = AboutMeController.validateFields(body, true);
		if (validationError) return validationError;

		const repository = new AboutMeRepository(env.DB);
		const created = await new AboutMeService(repository).create(body as unknown as CreateAboutMeDto);
		return Res.created(created);
	}

	/**
	 * @description Update About Me profile (admin only).
	 */
	static async update(request: Request, env: Env, idStr: string): Promise<Response> {
		const id = AboutMeController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		AboutMeController.normalizeBody(body);
		const validationError = AboutMeController.validateFields(body, false);
		if (validationError) return validationError;

		const repository = new AboutMeRepository(env.DB);
		const updated = await new AboutMeService(repository).update(id, body as unknown as UpdateAboutMeDto);
		if (!updated) {
			return Res.notFound("About Me profile not found");
		}
		return Res.ok(updated);
	}

	/**
	 * @description Delete About Me profile (admin only).
	 */
	static async delete(_request: Request, env: Env, idStr: string): Promise<Response> {
		const id = AboutMeController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new AboutMeRepository(env.DB);
		const deleted = await new AboutMeService(repository).delete(id);
		if (!deleted) {
			return Res.notFound("About Me profile not found");
		}
		return Res.noContent();
	}
}
