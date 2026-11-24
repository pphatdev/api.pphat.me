import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { ServicesRepository } from "./services.repo";
import { ServicesService } from "./services.service";
import type { CreateServiceDto, UpdateServiceDto, UpdateServiceSectionDto } from "./services.interface";

export class ServicesController {

	public static validateId(id: string): number | null {
		const n = Number(id);
		return Number.isInteger(n) && n > 0 ? n : null;
	}

	/**
	 * @description Normalise incoming body: accept camelCase aliases and intuitive names
	 * for snake_case columns. Mutates `body` in place.
	 */
	public static normalizeBody(body: Record<string, unknown>): void {
		const aliases: Array<[alias: string, target: string]> = [
			['sortOrder', 'sort_order'],
			['position', 'sort_order'],
			['sequence', 'sort_order'],
			['iconName', 'icon'],
			['linkUrl', 'link_url'],
			['url', 'link_url'],
			['isActive', 'status'],
			['is_active', 'status'],
		];
		for (const [alias, target] of aliases) {
			if (body[alias] !== undefined && body[target] === undefined) {
				body[target] = body[alias];
			}
			delete body[alias];
		}

		if (body.description === undefined) {
			if (typeof body.content === 'string') body.description = body.content;
			else if (typeof body.summary === 'string') body.description = body.summary;
		}
		delete body.content;
		delete body.summary;

		// Convert boolean status
		if (body.status !== undefined) {
			body.status = body.status === true || body.status === 1 || body.status === '1' ? 1 : 0;
		}
	}

	/**
	 * @description Validation for Service body.
	 */
	public static validateFields(body: Record<string, unknown>, isCreate: boolean): Response | null {
		if (isCreate) {
			if (typeof body.title !== 'string' || !body.title.trim()) {
				return Res.unprocessable("title is required and must be a non-empty string");
			}
			if (typeof body.description !== 'string' || !body.description.trim()) {
				return Res.unprocessable("description (or content/summary) is required and must be a non-empty string");
			}
		} else {
			if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
				return Res.unprocessable("title must be a non-empty string");
			}
			if (body.description !== undefined && (typeof body.description !== 'string' || !body.description.trim())) {
				return Res.unprocessable("description must be a non-empty string");
			}
		}

		if (body.icon !== undefined && typeof body.icon !== 'string') {
			return Res.unprocessable("icon must be a string");
		}
		if (body.category !== undefined && typeof body.category !== 'string') {
			return Res.unprocessable("category must be a string");
		}
		if (body.features !== undefined) {
			if (!Array.isArray(body.features) || body.features.some(f => typeof f !== 'string')) {
				return Res.unprocessable("features must be an array of strings");
			}
		}
		if (body.link_url !== undefined && typeof body.link_url !== 'string') {
			return Res.unprocessable("link_url must be a string");
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
	 * @description Validation for Service Section header.
	 */
	public static validateSectionFields(body: Record<string, unknown>): Response | null {
		if (body.badge !== undefined && typeof body.badge !== 'string') {
			return Res.unprocessable("badge must be a string");
		}
		if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
			return Res.unprocessable("title must be a non-empty string");
		}
		if (body.description !== undefined && typeof body.description !== 'string') {
			return Res.unprocessable("description must be a string");
		}
		if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}
		return null;
	}

	/**
	 * @description Get Overview: Section header + active services list for public portfolio.
	 */
	static async getOverview(_request: Request, env: Env): Promise<Response> {
		const repository = new ServicesRepository(env.DB);
		const overview = await new ServicesService(repository).getOverview();
		return Res.ok(overview);
	}

	/**
	 * @description Get section header configuration.
	 */
	static async getSection(_request: Request, env: Env): Promise<Response> {
		const repository = new ServicesRepository(env.DB);
		const section = await new ServicesService(repository).getSection();
		if (!section) {
			return Res.notFound("Service section configuration not found");
		}
		return Res.ok(section);
	}

	/**
	 * @description Update section header configuration (admin only).
	 */
	static async updateSection(request: Request, env: Env): Promise<Response> {
		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		if (body.label !== undefined && body.badge === undefined) {
			body.badge = body.label;
			delete body.label;
		}

		const validationError = ServicesController.validateSectionFields(body);
		if (validationError) return validationError;

		const repository = new ServicesRepository(env.DB);
		const updated = await new ServicesService(repository).updateSection(body as unknown as UpdateServiceSectionDto);
		return Res.ok(updated);
	}

	/**
	 * @description List services. Public callers see active (status=1). Admins can see all.
	 */
	static async list(request: Request, env: Env, isAdmin: boolean): Promise<Response> {
		const repository = new ServicesRepository(env.DB);
		const options = parseListParams(request.url);
		const url = new URL(request.url);
		const category = url.searchParams.get("category")?.trim() || undefined;
		const status = url.searchParams.get("status")?.trim() || undefined;

		const result = await new ServicesService(repository).list({
			...options,
			category,
			status,
			onlyActive: !isAdmin,
		});
		return Res.ok(result);
	}

	/**
	 * @description Get service by ID.
	 */
	static async getById(_request: Request, env: Env, idStr: string, isAdmin: boolean): Promise<Response> {
		const id = ServicesController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new ServicesRepository(env.DB);
		const item = await new ServicesService(repository).getById(id);
		if (!item) {
			return Res.notFound("Service not found");
		}

		if (item.status === 0 && !isAdmin) {
			return Res.notFound("Service not found");
		}

		return Res.ok(item);
	}

	/**
	 * @description Create service (admin only).
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		ServicesController.normalizeBody(body);
		const validationError = ServicesController.validateFields(body, true);
		if (validationError) return validationError;

		const repository = new ServicesRepository(env.DB);
		const created = await new ServicesService(repository).create(body as unknown as CreateServiceDto);
		return Res.created(created);
	}

	/**
	 * @description Update service (admin only).
	 */
	static async update(request: Request, env: Env, idStr: string): Promise<Response> {
		const id = ServicesController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		ServicesController.normalizeBody(body);
		const validationError = ServicesController.validateFields(body, false);
		if (validationError) return validationError;

		const repository = new ServicesRepository(env.DB);
		const updated = await new ServicesService(repository).update(id, body as unknown as UpdateServiceDto);
		if (!updated) {
			return Res.notFound("Service not found");
		}
		return Res.ok(updated);
	}

	/**
	 * @description Delete service (admin only).
	 */
	static async delete(_request: Request, env: Env, idStr: string): Promise<Response> {
		const id = ServicesController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new ServicesRepository(env.DB);
		const deleted = await new ServicesService(repository).delete(id);
		if (!deleted) {
			return Res.notFound("Service not found");
		}
		return Res.noContent();
	}

	/**
	 * @description Get service order sequence.
	 */
	static async getOrderSequence(_request: Request, env: Env): Promise<Response> {
		const repository = new ServicesRepository(env.DB);
		const sequence = await new ServicesService(repository).getOrderSequence();
		return Res.ok({ sequence });
	}

	/**
	 * @description Update service order sequence (admin only).
	 */
	static async updateOrderSequence(request: Request, env: Env): Promise<Response> {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		const repository = new ServicesRepository(env.DB);
		const service = new ServicesService(repository);

		if (Array.isArray(body)) {
			if (body.length === 0) {
				return Res.unprocessable("Sequence array cannot be empty");
			}
			if (typeof body[0] === 'object' && body[0] !== null && 'id' in body[0] && 'sequence' in body[0]) {
				const items = body as { id: number | string; sequence: number }[];
				const updatedCount = await service.updateOrderSequence(items);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} service(s)`, updatedCount });
			}
			const updatedCount = await service.reorder(body as (number | string)[]);
			return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} service(s)`, updatedCount });
		}

		if (typeof body === 'object' && body !== null) {
			const record = body as Record<string, unknown>;
			if (Array.isArray(record.sequence)) {
				const seq = record.sequence;
				if (seq.length === 0) return Res.unprocessable("sequence cannot be empty");
				if (typeof seq[0] === 'object' && seq[0] !== null && 'id' in seq[0] && 'sequence' in seq[0]) {
					const items = seq as { id: number | string; sequence: number }[];
					const updatedCount = await service.updateOrderSequence(items);
					return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} service(s)`, updatedCount });
				}
				const updatedCount = await service.reorder(seq as (number | string)[]);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} service(s)`, updatedCount });
			}
			if (Array.isArray(record.ids)) {
				const ids = record.ids as (number | string)[];
				if (ids.length === 0) return Res.unprocessable("ids cannot be empty");
				const updatedCount = await service.reorder(ids);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} service(s)`, updatedCount });
			}
		}

		return Res.unprocessable("Invalid body format: expected { ids: number[] } or { sequence: number[] } or { sequence: { id, sequence }[] }");
	}
}
