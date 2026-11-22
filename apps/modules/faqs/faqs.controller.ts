import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { FaqRepository } from "./faqs.repo";
import { FaqService } from "./faqs.service";

export class FaqsController {

	public static validateId(id: string): number | null {
		const n = Number(id);
		return Number.isInteger(n) && n > 0 ? n : null;
	}

	/**
	 * @description Normalise incoming body: accept camelCase aliases for snake_case columns.
	 */
	private static normalizeBody(body: Record<string, unknown>): void {
		const aliases: Array<[camel: string, snake: string]> = [
			['sortOrder', 'sort_order'],
			['articleId', 'article_id'],
		];
		for (const [camel, snake] of aliases) {
			if (body[camel] !== undefined && body[snake] === undefined) {
				body[snake] = body[camel];
			}
			delete body[camel];
		}
		// If content is provided and answer is missing, map content to answer
		if (body.content !== undefined && body.answer === undefined) {
			body.answer = body.content;
		}
	}

	/**
	 * @description Validation for FAQ body.
	 */
	private static validateFields(body: Record<string, unknown>, isCreate: boolean): Response | null {
		if (isCreate) {
			if (typeof body.question !== 'string' || !body.question.trim()) {
				return Res.unprocessable("question is required and must be a non-empty string");
			}
			const hasAnswer = typeof body.answer === 'string' && body.answer.trim().length > 0;
			const hasArticle = typeof body.article_id === 'string' && body.article_id.trim().length > 0;
			if (!hasAnswer && !hasArticle) {
				return Res.unprocessable("answer (or article_id) is required to supply content");
			}
		} else {
			if (body.question !== undefined && (typeof body.question !== 'string' || !body.question.trim())) {
				return Res.unprocessable("question must be a non-empty string");
			}
		}

		if (body.answer !== undefined && typeof body.answer !== 'string') {
			return Res.unprocessable("answer must be a string");
		}
		if (body.slug !== undefined && (typeof body.slug !== 'string' || !body.slug.trim())) {
			return Res.unprocessable("slug must be a non-empty string");
		}
		if (body.category !== undefined && typeof body.category !== 'string') {
			return Res.unprocessable("category must be a string");
		}
		if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
			return Res.unprocessable("status must be 0 or 1");
		}
		if (body.sort_order !== undefined && (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order))) {
			return Res.unprocessable("sort_order must be an integer");
		}
		if (body.article_id !== undefined && body.article_id !== null && (typeof body.article_id !== 'string' || !body.article_id.trim())) {
			return Res.unprocessable("article_id must be a string UUID or null");
		}
		return null;
	}

	private static handleDbError(err: unknown): Response {
		if (err instanceof Error) {
			if (err.message.includes("UNIQUE constraint failed: faqs.slug")) {
				return Res.conflict("An FAQ with this slug already exists");
			}
			if (err.message.includes("FOREIGN KEY constraint failed")) {
				return Res.unprocessable("article_id does not reference an existing article");
			}
		}
		throw err as Error;
	}

	/**
	 * @description List FAQs. Public callers only see status=1 (active).
	 * Admins can see all FAQs or filter by status.
	 */
	static async list(request: Request, env: Env, isAdmin: boolean): Promise<Response> {
		const repository = new FaqRepository(env.DB);
		const options = parseListParams(request.url);
		const url = new URL(request.url);
		const category = url.searchParams.get("category")?.trim() || undefined;
		const status = url.searchParams.get("status")?.trim() || undefined;

		const result = await new FaqService(repository).list({
			...options,
			category,
			status,
			onlyActive: !isAdmin,
		});
		return Res.ok(result);
	}

	/**
	 * @description Get FAQ by id or slug.
	 */
	static async getByIdOrSlug(_request: Request, env: Env, idOrSlug: string, isAdmin: boolean): Promise<Response> {
		const repository = new FaqRepository(env.DB);
		const faq = await new FaqService(repository).getByIdOrSlug(idOrSlug);
		if (!faq) return Res.notFound("FAQ not found");

		// If FAQ is inactive (status 0), only admin can see it
		if (faq.status === 0 && !isAdmin) {
			return Res.notFound("FAQ not found");
		}

		return Res.ok(faq);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		FaqsController.normalizeBody(dto);
		const invalid = FaqsController.validateFields(dto, true);
		if (invalid) return invalid;

		const repository = new FaqRepository(env.DB);
		try {
			const created = await new FaqService(repository).create(dto as never);
			return Res.created(created);
		} catch (err) {
			return FaqsController.handleDbError(err);
		}
	}

	static async update(request: Request, env: Env, id: string): Promise<Response> {
		const numericId = FaqsController.validateId(id);
		let targetId: number | null = numericId;

		const repository = new FaqRepository(env.DB);
		const service = new FaqService(repository);

		if (targetId === null) {
			const bySlug = await service.getBySlug(id);
			if (!bySlug) return Res.notFound("FAQ not found");
			targetId = bySlug.id;
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const dto = body as Record<string, unknown>;
		FaqsController.normalizeBody(dto);
		const invalid = FaqsController.validateFields(dto, false);
		if (invalid) return invalid;

		try {
			const updated = await service.update(targetId, dto as never);
			if (!updated) return Res.notFound("FAQ not found");
			return Res.ok(updated);
		} catch (err) {
			return FaqsController.handleDbError(err);
		}
	}

	static async delete(_request: Request, env: Env, id: string): Promise<Response> {
		const numericId = FaqsController.validateId(id);
		let targetId: number | null = numericId;

		const repository = new FaqRepository(env.DB);
		const service = new FaqService(repository);

		if (targetId === null) {
			const bySlug = await service.getBySlug(id);
			if (!bySlug) return Res.notFound("FAQ not found");
			targetId = bySlug.id;
		}

		const deleted = await service.delete(targetId);
		if (!deleted) return Res.notFound("FAQ not found");
		return Res.noContent();
	}

	/**
	 * @description Get FAQ order sequence list
	 * @method GET
	 */
	static async getOrderSequence(_request: Request, env: Env): Promise<Response> {
		const repository = new FaqRepository(env.DB);
		const list = await new FaqService(repository).getOrderSequence();
		return Res.ok(list);
	}

	/**
	 * @description Admin: update the FAQ order sequence.
	 * Accepts:
	 *   - `{ ids: (number | string)[] }` or `{ sequence: (number | string)[] }` or `(number | string)[]`
	 *   - `{ sequence: { id: number | string; sequence?: number; position?: number; sort_order?: number; sortOrder?: number }[] }`
	 *   - `Array<{ id: number | string; sequence?: number; position?: number }>`
	 * @method PUT, PATCH
	 */
	static async updateOrderSequence(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return Res.unprocessable('Invalid JSON body');
		}

		let items: unknown = body;
		if (!Array.isArray(body)) {
			items = (body as any).sequence ?? (body as any).ids ?? (body as any).faq_ids ?? (body as any).faqIds ?? (body as any).order ?? (body as any).items;
		}

		if (!Array.isArray(items) || items.length === 0) {
			return Res.unprocessable('Payload must be a non-empty array or an object containing an ids/sequence array');
		}

		const repository = new FaqRepository(env.DB);
		const service = new FaqService(repository);

		// Case 1: Array of IDs (numbers or numeric strings): [1, 2, 3] or ["1", "2", "3"]
		if (typeof items[0] === 'number' || (typeof items[0] === 'string' && /^\d+$/.test(items[0]))) {
			const idList: number[] = [];
			for (const raw of items) {
				const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
				if (isNaN(num) || num <= 0) {
					return Res.unprocessable('All IDs must be valid positive integers');
				}
				idList.push(num);
			}
			const updated = await service.reorder(idList);
			return Res.ok({ updated, message: 'FAQ order sequence updated successfully' });
		}

		// Case 2: Array of objects: [{ id, sequence?, position?, sortOrder?, sort_order? }, ...]
		if (typeof items[0] === 'object' && items[0] !== null) {
			const sequenceItems: { id: number; sequence: number }[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i] as any;
				const rawId = item?.id ?? item?.faq_id ?? item?.faqId;
				const idNum = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
				if (isNaN(idNum) || idNum <= 0) {
					return Res.unprocessable('Each item must include a valid numeric FAQ id');
				}
				const rawSeq = item?.sequence ?? item?.position ?? item?.sortOrder ?? item?.sort_order ?? item?.order;
				const seqNum = (rawSeq !== undefined && rawSeq !== null) ? Number(rawSeq) : i;
				if (!Number.isInteger(seqNum) || seqNum < 0) {
					return Res.unprocessable('Sequence numbers must be non-negative integers');
				}
				sequenceItems.push({ id: idNum, sequence: seqNum });
			}

			const updated = await service.updateOrderSequence(sequenceItems);
			return Res.ok({ updated, message: 'FAQ order sequence updated successfully' });
		}

		return Res.unprocessable('Invalid sequence item format');
	}
}
