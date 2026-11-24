import type {
	GalleryItem,
	GalleryItemRow,
	CreateGalleryItemDto,
	UpdateGalleryItemDto,
	GalleryListParams,
	IGalleryRepository,
	GalleryStats,
	GalleryOrderSequenceItem,
} from "./gallery.interface";
import { mapGalleryItemRow } from "./gallery.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class GalleryRepository implements IGalleryRepository {
	constructor(private readonly db: D1Database) { }

	private static readonly BASE_SELECT =
		`SELECT id, title, caption, alt_text, media_path, category, tags,
		        is_public, is_featured, sort_order, aspect_ratio, created_at, updated_at
		 FROM gallery`;

	/**
	 * @description Find all gallery items with pagination, search, category, and visibility filters.
	 * Default order: sort_order ASC, id ASC.
	 */
	async findAll(params: GalleryListParams): Promise<PaginatedResult<GalleryItem>> {
		const { page, limit, search, category, visibility, is_public, is_featured, onlyPublic, sort, order } = params;

		const ALLOWED_SORT_MAP: Record<string, string> = {
			id: 'id',
			title: 'title',
			category: 'category',
			sort_order: 'sort_order',
			sortOrder: 'sort_order',
			position: 'sort_order',
			sequence: 'sort_order',
			is_public: 'is_public',
			isPublic: 'is_public',
			is_featured: 'is_featured',
			isFeatured: 'is_featured',
			created_at: 'created_at',
			updated_at: 'updated_at',
		};

		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const chosen = sort?.[0] && ALLOWED_SORT_MAP[sort[0]];
		const orderBy = chosen ? `${chosen} ${safeOrder}` : `sort_order ASC, id ASC`;

		const conditions: string[] = [];
		const bindings: unknown[] = [];
		let idx = 1;

		if (search) {
			const like = `%${search}%`;
			conditions.push(
				`(title LIKE ?${idx} OR caption LIKE ?${idx + 1} OR alt_text LIKE ?${idx + 2} OR media_path LIKE ?${idx + 3} OR category LIKE ?${idx + 4} OR tags LIKE ?${idx + 5})`
			);
			bindings.push(like, like, like, like, like, like);
			idx += 6;
		}

		if (category && category !== 'all') {
			conditions.push(`category = ?${idx++}`);
			bindings.push(category);
		}

		if (onlyPublic) {
			conditions.push(`is_public = 1`);
		} else if (visibility) {
			if (visibility === 'public') {
				conditions.push(`is_public = 1`);
			} else if (visibility === 'hidden') {
				conditions.push(`is_public = 0`);
			} else if (visibility === 'featured') {
				conditions.push(`is_featured = 1`);
			}
		}

		if (is_public !== undefined && !onlyPublic && !visibility) {
			const pubVal = is_public === true || is_public === 1 || is_public === '1' ? 1 : 0;
			conditions.push(`is_public = ?${idx++}`);
			bindings.push(pubVal);
		}

		if (is_featured !== undefined && visibility !== 'featured') {
			const featVal = is_featured === true || is_featured === 1 || is_featured === '1' ? 1 : 0;
			conditions.push(`is_featured = ?${idx++}`);
			bindings.push(featVal);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (limit === -1) {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${GalleryRepository.BASE_SELECT} ${whereClause} ORDER BY ${orderBy}`)
					.bind(...bindings)
					.all<GalleryItemRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM gallery ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		} else {
			const offset = (page - 1) * limit;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${GalleryRepository.BASE_SELECT} ${whereClause} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
					.bind(...bindings, limit, offset)
					.all<GalleryItemRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM gallery ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const effectiveLimit = limit === -1 ? total : limit;
		const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0;

		return {
			data: (dataResult.results as GalleryItemRow[]).map(mapGalleryItemRow),
			pagination: { page, limit, total, totalPages },
		};
	}

	async findById(id: number): Promise<GalleryItem | null> {
		const row = await this.db
			.prepare(`${GalleryRepository.BASE_SELECT} WHERE id = ?1`)
			.bind(id)
			.first<GalleryItemRow>();
		return row ? mapGalleryItemRow(row) : null;
	}

	async findFeatured(): Promise<GalleryItem[]> {
		const res = await this.db
			.prepare(`${GalleryRepository.BASE_SELECT} WHERE is_public = 1 AND is_featured = 1 ORDER BY sort_order ASC, id ASC`)
			.all<GalleryItemRow>();
		return (res.results as GalleryItemRow[]).map(mapGalleryItemRow);
	}

	async getStats(): Promise<GalleryStats> {
		const [countsRow, categoriesResult] = await Promise.all([
			this.db
				.prepare(
					`SELECT 
						COUNT(*) as total,
						SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_count,
						SUM(CASE WHEN is_public = 0 THEN 1 ELSE 0 END) as hidden_count,
						SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured_count
					 FROM gallery`
				)
				.first<{ total: number; public_count: number; hidden_count: number; featured_count: number }>(),
			this.db
				.prepare(`SELECT DISTINCT category FROM gallery WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`)
				.all<{ category: string }>(),
		]);

		const total = countsRow?.total ?? 0;
		const publicCount = countsRow?.public_count ?? 0;
		const hiddenCount = countsRow?.hidden_count ?? 0;
		const featuredCount = countsRow?.featured_count ?? 0;
		const categories = (categoriesResult.results as { category: string }[]).map((r) => r.category);

		return {
			total,
			publicCount,
			hiddenCount,
			featuredCount,
			categoriesCount: categories.length,
			categories,
		};
	}

	async create(dto: CreateGalleryItemDto): Promise<GalleryItem> {
		const now = new Date().toISOString();
		const title = dto.title;
		const caption = dto.caption ?? '';
		const altText = dto.alt_text ?? '';
		const mediaPath = dto.media_path;
		const category = dto.category ?? 'photography';
		const tags = JSON.stringify(dto.tags ?? []);
		const isPublic = dto.is_public === false || dto.is_public === 0 ? 0 : 1;
		const isFeatured = dto.is_featured === true || dto.is_featured === 1 ? 1 : 0;
		const sortOrder = dto.sort_order ?? 0;
		const aspectRatio = dto.aspect_ratio ?? '16/9';

		const res = await this.db
			.prepare(
				`INSERT INTO gallery (
					title, caption, alt_text, media_path, category, tags,
					is_public, is_featured, sort_order, aspect_ratio, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
			)
			.bind(
				title,
				caption,
				altText,
				mediaPath,
				category,
				tags,
				isPublic,
				isFeatured,
				sortOrder,
				aspectRatio,
				now,
				now
			)
			.run();

		const id = res.meta?.last_row_id;
		if (!id) {
			throw new Error("Failed to retrieve created gallery item id");
		}

		const created = await this.findById(id);
		if (!created) {
			throw new Error(`Failed to find created gallery item with id ${id}`);
		}
		return created;
	}

	async update(id: number, dto: UpdateGalleryItemDto): Promise<GalleryItem | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		const now = new Date().toISOString();
		const sets: string[] = ['updated_at = ?1'];
		const bindings: unknown[] = [now];
		let idx = 2;

		if (dto.title !== undefined) {
			sets.push(`title = ?${idx++}`);
			bindings.push(dto.title);
		}
		if (dto.caption !== undefined) {
			sets.push(`caption = ?${idx++}`);
			bindings.push(dto.caption);
		}
		if (dto.alt_text !== undefined) {
			sets.push(`alt_text = ?${idx++}`);
			bindings.push(dto.alt_text);
		}
		if (dto.media_path !== undefined) {
			sets.push(`media_path = ?${idx++}`);
			bindings.push(dto.media_path);
		}
		if (dto.category !== undefined) {
			sets.push(`category = ?${idx++}`);
			bindings.push(dto.category);
		}
		if (dto.tags !== undefined) {
			sets.push(`tags = ?${idx++}`);
			bindings.push(JSON.stringify(dto.tags));
		}
		if (dto.is_public !== undefined) {
			const pubVal = dto.is_public === true || dto.is_public === 1 ? 1 : 0;
			sets.push(`is_public = ?${idx++}`);
			bindings.push(pubVal);
		}
		if (dto.is_featured !== undefined) {
			const featVal = dto.is_featured === true || dto.is_featured === 1 ? 1 : 0;
			sets.push(`is_featured = ?${idx++}`);
			bindings.push(featVal);
		}
		if (dto.sort_order !== undefined) {
			sets.push(`sort_order = ?${idx++}`);
			bindings.push(dto.sort_order);
		}
		if (dto.aspect_ratio !== undefined) {
			sets.push(`aspect_ratio = ?${idx++}`);
			bindings.push(dto.aspect_ratio);
		}

		bindings.push(id);
		await this.db
			.prepare(`UPDATE gallery SET ${sets.join(', ')} WHERE id = ?${idx}`)
			.bind(...bindings)
			.run();

		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const res = await this.db
			.prepare(`DELETE FROM gallery WHERE id = ?1`)
			.bind(id)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}

	async getOrderSequence(): Promise<GalleryOrderSequenceItem[]> {
		const res = await this.db
			.prepare(
				`SELECT id, title, category, media_path, sort_order, is_public, is_featured
				 FROM gallery
				 ORDER BY sort_order ASC, id ASC`
			)
			.all<{
				id: number;
				title: string;
				category: string;
				media_path: string;
				sort_order: number;
				is_public: number;
				is_featured: number;
			}>();

		return (res.results as Array<{
			id: number;
			title: string;
			category: string;
			media_path: string;
			sort_order: number;
			is_public: number;
			is_featured: number;
		}>).map((row) => ({
			id: row.id,
			title: row.title,
			category: row.category,
			mediaPath: row.media_path,
			sortOrder: row.sort_order ?? 0,
			position: row.sort_order ?? 0,
			sequence: row.sort_order ?? 0,
			isPublic: row.is_public === 1,
			isFeatured: row.is_featured === 1,
		}));
	}

	async updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		if (items.length === 0) return 0;
		const now = new Date().toISOString();
		const statements = items.map((item) =>
			this.db
				.prepare(`UPDATE gallery SET sort_order = ?1, updated_at = ?2 WHERE id = ?3`)
				.bind(item.sequence, now, Number(item.id))
		);
		await this.db.batch(statements);
		return items.length;
	}

	async reorder(orderedIds: (number | string)[]): Promise<number> {
		if (orderedIds.length === 0) return 0;
		const items = orderedIds.map((id, index) => ({ id, sequence: index }));
		return this.updateOrderSequence(items);
	}
}
