import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { GalleryRepository } from "./gallery.repo";
import { GalleryService } from "./gallery.service";
import { GALLERY_ASPECT_RATIOS } from "./gallery.interface";
import type { CreateGalleryItemDto, UpdateGalleryItemDto, GalleryAspectRatio } from "./gallery.interface";

export class GalleryController {

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
			['mediaPath', 'media_path'],
			['altText', 'alt_text'],
			['alt', 'alt_text'],
			['isPublic', 'is_public'],
			['isFeatured', 'is_featured'],
			['sortOrder', 'sort_order'],
			['position', 'sort_order'],
			['sequence', 'sort_order'],
			['aspectRatio', 'aspect_ratio'],
		];
		for (const [alias, target] of aliases) {
			if (body[alias] !== undefined && body[target] === undefined) {
				body[target] = body[alias];
			}
			delete body[alias];
		}

		// Additional media / image fallbacks
		if (body.media_path === undefined) {
			if (typeof body.url === 'string') body.media_path = body.url;
			else if (typeof body.image === 'string') body.media_path = body.image;
			else if (typeof body.src === 'string') body.media_path = body.src;
			else if (typeof body.image_url === 'string') body.media_path = body.image_url;
		}
		delete body.url;
		delete body.image;
		delete body.src;
		delete body.image_url;

		// Status / published fallbacks
		if (body.is_public === undefined) {
			if (body.published !== undefined) body.is_public = body.published;
			else if (body.status !== undefined) body.is_public = body.status;
		}
		delete body.published;
		delete body.status;

		if (body.is_featured === undefined && body.featured !== undefined) {
			body.is_featured = body.featured;
		}
		delete body.featured;

		// Convert booleans to 0 or 1
		if (body.is_public !== undefined) {
			body.is_public = body.is_public === true || body.is_public === 1 || body.is_public === '1' ? 1 : 0;
		}
		if (body.is_featured !== undefined) {
			body.is_featured = body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0;
		}
	}

	/**
	 * @description Validation for Gallery body.
	 */
	public static validateFields(body: Record<string, unknown>, isCreate: boolean): Response | null {
		if (isCreate) {
			if (typeof body.title !== 'string' || !body.title.trim()) {
				return Res.unprocessable("title is required and must be a non-empty string");
			}
			if (typeof body.media_path !== 'string' || !body.media_path.trim()) {
				return Res.unprocessable("media_path (or mediaPath/url/image) is required and must be a non-empty string");
			}
		} else {
			if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
				return Res.unprocessable("title must be a non-empty string");
			}
			if (body.media_path !== undefined && (typeof body.media_path !== 'string' || !body.media_path.trim())) {
				return Res.unprocessable("media_path must be a non-empty string");
			}
		}

		if (body.caption !== undefined && typeof body.caption !== 'string') {
			return Res.unprocessable("caption must be a string");
		}
		if (body.alt_text !== undefined && typeof body.alt_text !== 'string') {
			return Res.unprocessable("alt_text must be a string");
		}
		if (body.category !== undefined && (typeof body.category !== 'string' || !body.category.trim())) {
			return Res.unprocessable("category must be a non-empty string");
		}
		if (body.tags !== undefined) {
			if (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== 'string')) {
				return Res.unprocessable("tags must be an array of strings");
			}
		}
		if (body.is_public !== undefined && body.is_public !== 0 && body.is_public !== 1) {
			return Res.unprocessable("is_public must be 0 or 1 (or boolean)");
		}
		if (body.is_featured !== undefined && body.is_featured !== 0 && body.is_featured !== 1) {
			return Res.unprocessable("is_featured must be 0 or 1 (or boolean)");
		}
		if (body.sort_order !== undefined && (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order))) {
			return Res.unprocessable("sort_order must be an integer");
		}
		if (body.aspect_ratio !== undefined && !GALLERY_ASPECT_RATIOS.includes(body.aspect_ratio as GalleryAspectRatio)) {
			return Res.unprocessable(`aspect_ratio must be one of: ${GALLERY_ASPECT_RATIOS.join(', ')}`);
		}
		return null;
	}

	/**
	 * @description List gallery items with pagination, search, category, and visibility filtering.
	 */
	static async list(request: Request, env: Env, isAdmin: boolean): Promise<Response> {
		const repository = new GalleryRepository(env.DB);
		const options = parseListParams(request.url);
		const url = new URL(request.url);
		const category = url.searchParams.get("category")?.trim() || undefined;
		const visibility = url.searchParams.get("visibility")?.trim() as 'all' | 'public' | 'hidden' | 'featured' | undefined;
		const isPublicParam = url.searchParams.get("is_public") ?? url.searchParams.get("isPublic");
		const isFeaturedParam = url.searchParams.get("is_featured") ?? url.searchParams.get("isFeatured");

		const is_public = isPublicParam !== null ? isPublicParam === 'true' || isPublicParam === '1' : undefined;
		const is_featured = isFeaturedParam !== null ? isFeaturedParam === 'true' || isFeaturedParam === '1' : undefined;

		const result = await new GalleryService(repository).list({
			...options,
			category,
			visibility,
			is_public,
			is_featured,
			onlyPublic: !isAdmin,
		});
		return Res.ok(result);
	}

	/**
	 * @description Get featured gallery items (public).
	 */
	static async getFeatured(_request: Request, env: Env): Promise<Response> {
		const repository = new GalleryRepository(env.DB);
		const items = await new GalleryService(repository).getFeatured();
		return Res.ok({ data: items, total: items.length });
	}

	/**
	 * @description Get gallery statistics for dashboard.
	 */
	static async getStats(_request: Request, env: Env): Promise<Response> {
		const repository = new GalleryRepository(env.DB);
		const stats = await new GalleryService(repository).getStats();
		return Res.ok(stats);
	}

	/**
	 * @description Get gallery item by numeric ID.
	 */
	static async getById(_request: Request, env: Env, idStr: string, isAdmin: boolean): Promise<Response> {
		const id = GalleryController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new GalleryRepository(env.DB);
		const item = await new GalleryService(repository).getById(id);
		if (!item) {
			return Res.notFound("Gallery item not found");
		}

		if (!item.isPublic && !isAdmin) {
			return Res.notFound("Gallery item not found");
		}

		return Res.ok(item);
	}

	/**
	 * @description Create gallery item (admin only).
	 * Supports single object creation or bulk creation via array or `{ items: [...] }`.
	 */
	static async create(request: Request, env: Env): Promise<Response> {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		const repository = new GalleryRepository(env.DB);
		const service = new GalleryService(repository);

		// Bulk creation support (useful for admin media library import)
		if (Array.isArray(body)) {
			if (body.length === 0) {
				return Res.unprocessable("Array of items cannot be empty");
			}
			const createdList: unknown[] = [];
			for (const rawItem of body) {
				if (typeof rawItem !== 'object' || rawItem === null) {
					return Res.unprocessable("Each item in array must be an object");
				}
				const item = { ...rawItem } as Record<string, unknown>;
				GalleryController.normalizeBody(item);
				const err = GalleryController.validateFields(item, true);
				if (err) return err;
				const created = await service.create(item as unknown as CreateGalleryItemDto);
				createdList.push(created);
			}
			return Res.created({ data: createdList, count: createdList.length });
		}

		if (typeof body !== 'object' || body === null) {
			return Res.badRequest("Request body must be a JSON object or array");
		}

		const item = { ...(body as Record<string, unknown>) };
		GalleryController.normalizeBody(item);
		const validationError = GalleryController.validateFields(item, true);
		if (validationError) return validationError;

		const created = await service.create(item as unknown as CreateGalleryItemDto);
		return Res.created(created);
	}

	/**
	 * @description Update gallery item (admin only).
	 */
	static async update(request: Request, env: Env, idStr: string): Promise<Response> {
		const id = GalleryController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		let body: Record<string, unknown>;
		try {
			body = await request.json() as Record<string, unknown>;
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		GalleryController.normalizeBody(body);
		const validationError = GalleryController.validateFields(body, false);
		if (validationError) return validationError;

		const repository = new GalleryRepository(env.DB);
		const updated = await new GalleryService(repository).update(id, body as unknown as UpdateGalleryItemDto);
		if (!updated) {
			return Res.notFound("Gallery item not found");
		}
		return Res.ok(updated);
	}

	/**
	 * @description Toggle public visibility of gallery item (admin only).
	 */
	static async togglePublic(_request: Request, env: Env, idStr: string): Promise<Response> {
		const id = GalleryController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new GalleryRepository(env.DB);
		const service = new GalleryService(repository);
		const existing = await service.getById(id);
		if (!existing) {
			return Res.notFound("Gallery item not found");
		}

		const nextPublic = existing.isPublic ? 0 : 1;
		const updated = await service.update(id, { is_public: nextPublic });
		return Res.ok(updated);
	}

	/**
	 * @description Toggle featured status of gallery item (admin only).
	 */
	static async toggleFeatured(_request: Request, env: Env, idStr: string): Promise<Response> {
		const id = GalleryController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new GalleryRepository(env.DB);
		const service = new GalleryService(repository);
		const existing = await service.getById(id);
		if (!existing) {
			return Res.notFound("Gallery item not found");
		}

		const nextFeatured = existing.isFeatured ? 0 : 1;
		const updated = await service.update(id, { is_featured: nextFeatured });
		return Res.ok(updated);
	}

	/**
	 * @description Delete gallery item (admin only).
	 */
	static async delete(_request: Request, env: Env, idStr: string): Promise<Response> {
		const id = GalleryController.validateId(idStr);
		if (id === null) {
			return Res.badRequest("Invalid ID format: must be a positive integer");
		}

		const repository = new GalleryRepository(env.DB);
		const deleted = await new GalleryService(repository).delete(id);
		if (!deleted) {
			return Res.notFound("Gallery item not found");
		}
		return Res.noContent();
	}

	/**
	 * @description Get Gallery Order Sequence
	 */
	static async getOrderSequence(_request: Request, env: Env): Promise<Response> {
		const repository = new GalleryRepository(env.DB);
		const sequence = await new GalleryService(repository).getOrderSequence();
		return Res.ok({ sequence });
	}

	/**
	 * @description Update Gallery Order Sequence (admin only)
	 */
	static async updateOrderSequence(request: Request, env: Env): Promise<Response> {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Res.badRequest("Invalid JSON body");
		}

		const repository = new GalleryRepository(env.DB);
		const service = new GalleryService(repository);

		if (Array.isArray(body)) {
			if (body.length === 0) {
				return Res.unprocessable("Sequence array cannot be empty");
			}
			if (typeof body[0] === 'object' && body[0] !== null && 'id' in body[0] && 'sequence' in body[0]) {
				const items = body as { id: number | string; sequence: number }[];
				const updatedCount = await service.updateOrderSequence(items);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} gallery item(s)`, updatedCount });
			}
			const updatedCount = await service.reorder(body as (number | string)[]);
			return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} gallery item(s)`, updatedCount });
		}

		if (typeof body === 'object' && body !== null) {
			const record = body as Record<string, unknown>;
			if (Array.isArray(record.sequence)) {
				const seq = record.sequence;
				if (seq.length === 0) return Res.unprocessable("sequence cannot be empty");
				if (typeof seq[0] === 'object' && seq[0] !== null && 'id' in seq[0] && 'sequence' in seq[0]) {
					const items = seq as { id: number | string; sequence: number }[];
					const updatedCount = await service.updateOrderSequence(items);
					return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} gallery item(s)`, updatedCount });
				}
				const updatedCount = await service.reorder(seq as (number | string)[]);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} gallery item(s)`, updatedCount });
			}
			if (Array.isArray(record.ids)) {
				const ids = record.ids as (number | string)[];
				if (ids.length === 0) return Res.unprocessable("ids cannot be empty");
				const updatedCount = await service.reorder(ids);
				return Res.ok({ message: `Successfully updated order sequence for ${updatedCount} gallery item(s)`, updatedCount });
			}
		}

		return Res.unprocessable("Invalid body format: expected { ids: number[] } or { sequence: number[] } or { sequence: { id, sequence }[] }");
	}
}
