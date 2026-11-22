import type {
	Faq,
	FaqRow,
	CreateFaqDto,
	UpdateFaqDto,
	FaqListParams,
	IFaqRepository,
	FaqOrderSequenceItem,
} from "./faqs.interface";
import { computeFaqStats, slugify } from "./faqs.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class FaqRepository implements IFaqRepository {
	constructor(private readonly db: D1Database) { }

	private static readonly SELECT_WITH_ARTICLE =
		`SELECT f.id, f.question, f.slug, f.answer, f.category, f.sort_order, f.status, f.article_id, f.created_at, f.updated_at,
		        a.title AS article_title, a.slug AS article_slug, a.description AS article_description
		 FROM faqs f
		 LEFT JOIN articles a ON a.id = f.article_id`;

	/**
	 * @description Find all FAQs with pagination, search, category, and status filters.
	 * Default order: sort_order ASC, then id ASC.
	 */
	async findAll(params: FaqListParams): Promise<PaginatedResult<Faq>> {
		const { page, limit, search, sort, order, category, status, onlyActive } = params;

		const ALLOWED_SORT_MAP: Record<string, string> = {
			id: 'f.id',
			question: 'f.question',
			slug: 'f.slug',
			category: 'f.category',
			sort_order: 'f.sort_order',
			sortOrder: 'f.sort_order',
			position: 'f.sort_order',
			sequence: 'f.sort_order',
			status: 'f.status',
			created_at: 'f.created_at',
			updated_at: 'f.updated_at',
		};

		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const chosen = sort?.[0] && ALLOWED_SORT_MAP[sort[0]];
		const orderBy = chosen ? `${chosen} ${safeOrder}` : `f.sort_order ASC, f.id ASC`;

		const conditions: string[] = [];
		const bindings: unknown[] = [];
		let idx = 1;

		if (search) {
			const like = `%${search}%`;
			conditions.push(`(f.question LIKE ?${idx} OR f.answer LIKE ?${idx + 1} OR f.category LIKE ?${idx + 2})`);
			bindings.push(like, like, like);
			idx += 3;
		}

		if (category) {
			conditions.push(`f.category = ?${idx++}`);
			bindings.push(category);
		}

		if (onlyActive) {
			conditions.push(`f.status = 1`);
		} else if (status !== undefined && status !== 'all') {
			const numStatus = parseInt(status, 10);
			if (!isNaN(numStatus)) {
				conditions.push(`f.status = ?${idx++}`);
				bindings.push(numStatus);
			}
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (limit === -1) {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${FaqRepository.SELECT_WITH_ARTICLE} ${whereClause} ORDER BY ${orderBy}`)
					.bind(...bindings)
					.all<FaqRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM faqs f ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		} else {
			const offset = (page - 1) * limit;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${FaqRepository.SELECT_WITH_ARTICLE} ${whereClause} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
					.bind(...bindings, limit, offset)
					.all<FaqRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM faqs f ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const effectiveLimit = limit === -1 ? total : limit;
		const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0;

		return {
			data: (dataResult.results as FaqRow[]).map(this.mapRow),
			pagination: { page, limit, total, totalPages },
		};
	}

	async findById(id: number): Promise<Faq | null> {
		const row = await this.db
			.prepare(`${FaqRepository.SELECT_WITH_ARTICLE} WHERE f.id = ?1`)
			.bind(id)
			.first<FaqRow>();
		return row ? this.mapRow(row) : null;
	}

	async findBySlug(slug: string): Promise<Faq | null> {
		const row = await this.db
			.prepare(`${FaqRepository.SELECT_WITH_ARTICLE} WHERE f.slug = ?1`)
			.bind(slug)
			.first<FaqRow>();
		return row ? this.mapRow(row) : null;
	}

	async findByIdOrSlug(idOrSlug: string): Promise<Faq | null> {
		if (/^\d+$/.test(idOrSlug)) {
			const byId = await this.findById(parseInt(idOrSlug, 10));
			if (byId) return byId;
		}
		return this.findBySlug(idOrSlug);
	}

	async create(dto: CreateFaqDto): Promise<Faq> {
		const now = new Date().toISOString();
		let answer = dto.answer ?? dto.content ?? '';
		const articleId = dto.article_id ?? dto.articleId ?? null;

		// If answer is empty but article_id is linked, inherit answer from article content/description
		if (!answer.trim() && articleId) {
			const article = await this.db
				.prepare("SELECT content, description FROM articles WHERE id = ?1")
				.bind(articleId)
				.first<{ content: string; description: string }>();
			if (article) {
				answer = article.content || article.description;
			}
		}

		let slug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.question);
		if (!slug) slug = `faq-${Date.now()}`;

		const category = dto.category?.trim() || 'General';
		const sortOrder = Number.isInteger(dto.sort_order ?? dto.sortOrder) ? (dto.sort_order ?? dto.sortOrder)! : 0;
		const status = dto.status === 0 ? 0 : 1;

		const result = await this.db
			.prepare(
				"INSERT INTO faqs (question, slug, answer, category, sort_order, status, article_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
			)
			.bind(
				dto.question.trim(),
				slug,
				answer,
				category,
				sortOrder,
				status,
				articleId,
				now,
				now,
			)
			.run();

		const id = result.meta.last_row_id as number;
		return (await this.findById(id))!;
	}

	async update(id: number, dto: UpdateFaqDto): Promise<Faq | null> {
		const existing = await this.db
			.prepare("SELECT id FROM faqs WHERE id = ?1")
			.bind(id)
			.first<{ id: number }>();
		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.question !== undefined) {
			fields.push(`question = ?${idx++}`);
			values.push(dto.question.trim());
		}

		const answer = dto.answer !== undefined ? dto.answer : dto.content;
		if (answer !== undefined) {
			fields.push(`answer = ?${idx++}`);
			values.push(answer);
		}

		if (dto.slug !== undefined) {
			fields.push(`slug = ?${idx++}`);
			values.push(slugify(dto.slug) || `faq-${id}`);
		}

		if (dto.category !== undefined) {
			fields.push(`category = ?${idx++}`);
			values.push(dto.category.trim() || 'General');
		}

		const sortOrder = dto.sort_order !== undefined ? dto.sort_order : dto.sortOrder;
		if (sortOrder !== undefined) {
			fields.push(`sort_order = ?${idx++}`);
			values.push(sortOrder);
		}

		if (dto.status !== undefined) {
			fields.push(`status = ?${idx++}`);
			values.push(dto.status === 0 ? 0 : 1);
		}

		const articleId = dto.article_id !== undefined ? dto.article_id : dto.articleId;
		if (articleId !== undefined) {
			fields.push(`article_id = ?${idx++}`);
			values.push(articleId || null);
		}

		if (fields.length === 0) return this.findById(id);

		fields.push(`updated_at = ?${idx++}`);
		values.push(new Date().toISOString());

		values.push(id);

		await this.db
			.prepare(`UPDATE faqs SET ${fields.join(", ")} WHERE id = ?${idx}`)
			.bind(...values)
			.run();

		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM faqs WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	private mapRow(row: FaqRow): Faq {
		const stats = computeFaqStats(row.answer);
		return {
			id: row.id,
			question: row.question,
			slug: row.slug,
			answer: row.answer,
			content: row.answer,
			category: row.category,
			sortOrder: row.sort_order,
			position: row.sort_order,
			sequence: row.sort_order,
			status: row.status === 0 ? 0 : 1,
			articleId: row.article_id,
			article: row.article_id
				? {
					id: row.article_id,
					title: row.article_title ?? '',
					slug: row.article_slug ?? '',
					description: row.article_description ?? '',
				}
				: null,
			readingMins: stats.readingMins,
			wordCount: stats.wordCount,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	/**
	 * @description Replace the admin-controlled sort order of FAQs.
	 * Writes `sort_order = 0..N-1` for the given ids.
	 * @param { (number | string)[] } orderedIds FAQ ids in the desired order
	 * @returns { Promise<number> } Number of rows actually updated
	 */
	async reorder(orderedIds: (number | string)[]): Promise<number> {
		if (orderedIds.length === 0) return 0;
		const seen = new Set<number>();
		const unique: number[] = [];
		for (const raw of orderedIds) {
			const id = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
			if (!isNaN(id) && !seen.has(id)) {
				seen.add(id);
				unique.push(id);
			}
		}
		if (unique.length === 0) return 0;

		const now = new Date().toISOString();
		const stmts = unique.map((id, index) =>
			this.db
				.prepare("UPDATE faqs SET sort_order = ?1, updated_at = ?2 WHERE id = ?3")
				.bind(index, now, id),
		);
		const results = await this.db.batch(stmts);
		return results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
	}

	/**
	 * @description Update FAQ order sequence with explicit sequence numbers.
	 * @param { { id: number | string; sequence: number }[] } items Items with id and sequence
	 * @returns { Promise<number> } Number of rows updated
	 */
	async updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		if (items.length === 0) return 0;
		const map = new Map<number, number>();
		for (const item of items) {
			const id = typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
			if (!isNaN(id)) {
				map.set(id, item.sequence);
			}
		}
		if (map.size === 0) return 0;

		const now = new Date().toISOString();
		const stmts = Array.from(map.entries()).map(([id, sequence]) =>
			this.db
				.prepare("UPDATE faqs SET sort_order = ?1, updated_at = ?2 WHERE id = ?3")
				.bind(sequence, now, id),
		);
		const results = await this.db.batch(stmts);
		return results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
	}

	/**
	 * @description Get FAQ order sequence list
	 * @returns { Promise<FaqOrderSequenceItem[]> } FAQs in display order
	 */
	async getOrderSequence(): Promise<FaqOrderSequenceItem[]> {
		const result = await this.db
			.prepare("SELECT id, question, slug, category, sort_order, status FROM faqs ORDER BY sort_order ASC, id ASC")
			.all<{ id: number; question: string; slug: string; category: string; sort_order: number; status: number }>();

		return (result.results ?? []).map((r) => ({
			id: r.id,
			question: r.question,
			slug: r.slug,
			category: r.category,
			sortOrder: r.sort_order,
			position: r.sort_order,
			sequence: r.sort_order,
			status: r.status === 0 ? 0 : 1,
		}));
	}
}
