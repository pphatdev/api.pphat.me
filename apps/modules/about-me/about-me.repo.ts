import type {
	AboutMe,
	AboutMeRow,
	CreateAboutMeDto,
	UpdateAboutMeDto,
	AboutMeListParams,
	IAboutMeRepository,
} from "./about-me.interface";
import { mapAboutMeRow } from "./about-me.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class AboutMeRepository implements IAboutMeRepository {
	constructor(private readonly db: D1Database) { }

	private static readonly BASE_SELECT =
		`SELECT id, badge, title, description, button_text, button_url, images,
		        name, nickname, role, location, sort_order, status, created_at, updated_at
		 FROM about_me`;

	/**
	 * @description Find all About Me profiles with pagination, search, and status filters.
	 * Default order: sort_order ASC, id ASC.
	 */
	async findAll(params: AboutMeListParams): Promise<PaginatedResult<AboutMe>> {
		const { page, limit, search, sort, order, status, onlyActive } = params;

		const ALLOWED_SORT_MAP: Record<string, string> = {
			id: 'id',
			badge: 'badge',
			title: 'title',
			name: 'name',
			nickname: 'nickname',
			role: 'role',
			location: 'location',
			sort_order: 'sort_order',
			sortOrder: 'sort_order',
			status: 'status',
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
				`(title LIKE ?${idx} OR description LIKE ?${idx + 1} OR name LIKE ?${idx + 2} OR nickname LIKE ?${idx + 3} OR role LIKE ?${idx + 4} OR location LIKE ?${idx + 5})`
			);
			bindings.push(like, like, like, like, like, like);
			idx += 6;
		}

		if (onlyActive) {
			conditions.push(`status = 1`);
		} else if (status !== undefined && status !== 'all') {
			const numStatus = parseInt(status, 10);
			if (!isNaN(numStatus)) {
				conditions.push(`status = ?${idx++}`);
				bindings.push(numStatus);
			}
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (limit === -1) {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${AboutMeRepository.BASE_SELECT} ${whereClause} ORDER BY ${orderBy}`)
					.bind(...bindings)
					.all<AboutMeRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM about_me ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		} else {
			const offset = (page - 1) * limit;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${AboutMeRepository.BASE_SELECT} ${whereClause} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
					.bind(...bindings, limit, offset)
					.all<AboutMeRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM about_me ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const effectiveLimit = limit === -1 ? total : limit;
		const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0;

		return {
			data: (dataResult.results as AboutMeRow[]).map(mapAboutMeRow),
			pagination: { page, limit, total, totalPages },
		};
	}

	async findById(id: number): Promise<AboutMe | null> {
		const row = await this.db
			.prepare(`${AboutMeRepository.BASE_SELECT} WHERE id = ?1`)
			.bind(id)
			.first<AboutMeRow>();
		return row ? mapAboutMeRow(row) : null;
	}

	async findActive(): Promise<AboutMe | null> {
		const row = await this.db
			.prepare(`${AboutMeRepository.BASE_SELECT} WHERE status = 1 ORDER BY sort_order ASC, id ASC LIMIT 1`)
			.first<AboutMeRow>();
		return row ? mapAboutMeRow(row) : null;
	}

	async create(dto: CreateAboutMeDto): Promise<AboutMe> {
		const now = new Date().toISOString();
		const badge = dto.badge ?? 'About me!';
		const title = dto.title;
		const description = dto.description;
		const buttonText = dto.button_text ?? 'Gallery';
		const buttonUrl = dto.button_url ?? '';
		const images = JSON.stringify(dto.images ?? []);
		const name = dto.name ?? '';
		const nickname = dto.nickname ?? '';
		const role = dto.role ?? '';
		const location = dto.location ?? '';
		const sortOrder = dto.sort_order ?? 0;
		const status = dto.status ?? 1;

		const insertResult = await this.db
			.prepare(
				`INSERT INTO about_me (
					badge, title, description, button_text, button_url, images,
					name, nickname, role, location, sort_order, status, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
			)
			.bind(
				badge,
				title,
				description,
				buttonText,
				buttonUrl,
				images,
				name,
				nickname,
				role,
				location,
				sortOrder,
				status,
				now,
				now
			)
			.run();

		const id = insertResult.meta?.last_row_id;
		if (!id) {
			throw new Error("Failed to retrieve created about_me record id");
		}

		const created = await this.findById(id);
		if (!created) {
			throw new Error(`Failed to find created about_me record with id ${id}`);
		}
		return created;
	}

	async update(id: number, dto: UpdateAboutMeDto): Promise<AboutMe | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		const now = new Date().toISOString();
		const sets: string[] = ['updated_at = ?1'];
		const bindings: unknown[] = [now];
		let idx = 2;

		if (dto.badge !== undefined) {
			sets.push(`badge = ?${idx++}`);
			bindings.push(dto.badge);
		}
		if (dto.title !== undefined) {
			sets.push(`title = ?${idx++}`);
			bindings.push(dto.title);
		}
		if (dto.description !== undefined) {
			sets.push(`description = ?${idx++}`);
			bindings.push(dto.description);
		}
		if (dto.button_text !== undefined) {
			sets.push(`button_text = ?${idx++}`);
			bindings.push(dto.button_text);
		}
		if (dto.button_url !== undefined) {
			sets.push(`button_url = ?${idx++}`);
			bindings.push(dto.button_url);
		}
		if (dto.images !== undefined) {
			sets.push(`images = ?${idx++}`);
			bindings.push(JSON.stringify(dto.images));
		}
		if (dto.name !== undefined) {
			sets.push(`name = ?${idx++}`);
			bindings.push(dto.name);
		}
		if (dto.nickname !== undefined) {
			sets.push(`nickname = ?${idx++}`);
			bindings.push(dto.nickname);
		}
		if (dto.role !== undefined) {
			sets.push(`role = ?${idx++}`);
			bindings.push(dto.role);
		}
		if (dto.location !== undefined) {
			sets.push(`location = ?${idx++}`);
			bindings.push(dto.location);
		}
		if (dto.sort_order !== undefined) {
			sets.push(`sort_order = ?${idx++}`);
			bindings.push(dto.sort_order);
		}
		if (dto.status !== undefined) {
			sets.push(`status = ?${idx++}`);
			bindings.push(dto.status);
		}

		bindings.push(id);
		await this.db
			.prepare(`UPDATE about_me SET ${sets.join(', ')} WHERE id = ?${idx}`)
			.bind(...bindings)
			.run();

		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const res = await this.db
			.prepare(`DELETE FROM about_me WHERE id = ?1`)
			.bind(id)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}
}
