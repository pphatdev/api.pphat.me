import type { TechStack, TechStackRow, CreateTechStackDto, ITechStackRepository, UpdateTechStackDto } from "./tech-stacks.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class TechStackRepository implements ITechStackRepository {
	constructor(private readonly db: D1Database) { }

	/**
	 * @description Find all tech stacks with pagination and optional search.
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<TechStack>> } Paginated tech stacks
	 */
	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<TechStack>> {
		const ALLOWED_SORT = ['id', 'name', 'status', 'created_at', 'updated_at'];
		const safeSort = sort?.[0] && ALLOWED_SORT.includes(sort[0]) ? sort[0] : 'id';
		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM tech_stacks WHERE (name LIKE ?1 OR description LIKE ?2) ORDER BY ${safeSort} ${safeOrder} LIMIT ?3 OFFSET ?4`)
					.bind(like, like, limit, offset)
					.all<TechStackRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM tech_stacks WHERE (name LIKE ?1 OR description LIKE ?2)")
					.bind(like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM tech_stacks ORDER BY ${safeSort} ${safeOrder} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<TechStackRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM tech_stacks")
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		return {
			data: (dataResult.results as TechStackRow[]).map(this.mapRow),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/**
	 * @description Find a tech stack by id.
	 * @param { number } id Tech stack id
	 * @returns { Promise<TechStack | null> } Tech stack or null
	 */
	async findById(id: number): Promise<TechStack | null> {
		const row = await this.db
			.prepare("SELECT * FROM tech_stacks WHERE id = ?1")
			.bind(id)
			.first<TechStackRow>();
		return row ? this.mapRow(row) : null;
	}

	/**
	 * @description Create a tech stack.
	 * @param { CreateTechStackDto } dto Tech stack data
	 * @returns { Promise<TechStack> } Created tech stack
	 */
	async create(dto: CreateTechStackDto): Promise<TechStack> {
		const now = new Date().toISOString();
		// Normalise status: anything other than exactly 0 falls back to
		// active (1). The CHECK constraint enforces this at the DB level too.
		const status = dto.status === 0 ? 0 : 1;
		const result = await this.db
			.prepare(
				"INSERT INTO tech_stacks (name, description, url, logo_url, cover, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
			)
			.bind(
				dto.name,
				dto.description ?? '',
				dto.url ?? '',
				dto.logo_url ?? '',
				dto.cover ?? null,
				status,
				now,
				now,
			)
			.run();

		const id = result.meta.last_row_id as number;
		const row = await this.db
			.prepare("SELECT * FROM tech_stacks WHERE id = ?1")
			.bind(id)
			.first<TechStackRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Update a tech stack. Partial — only provided fields change.
	 * @param { number } id Tech stack id
	 * @param { UpdateTechStackDto } dto Fields to update
	 * @returns { Promise<TechStack | null> } Updated tech stack or null when the id is unknown
	 */
	async update(id: number, dto: UpdateTechStackDto): Promise<TechStack | null> {
		const existing = await this.db
			.prepare("SELECT * FROM tech_stacks WHERE id = ?1")
			.bind(id)
			.first<TechStackRow>();
		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.name !== undefined) { fields.push(`name = ?${idx++}`); values.push(dto.name); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.url !== undefined) { fields.push(`url = ?${idx++}`); values.push(dto.url); }
		if (dto.logo_url !== undefined) { fields.push(`logo_url = ?${idx++}`); values.push(dto.logo_url); }
		if (dto.cover !== undefined) { fields.push(`cover = ?${idx++}`); values.push(dto.cover); }
		if (dto.status !== undefined) { fields.push(`status = ?${idx++}`); values.push(dto.status === 0 ? 0 : 1); }

		if (fields.length === 0) return this.mapRow(existing);

		fields.push(`updated_at = ?${idx}`);
		values.push(new Date().toISOString());
		values.push(id);

		await this.db
			.prepare(`UPDATE tech_stacks SET ${fields.join(", ")} WHERE id = ?${idx + 1}`)
			.bind(...values)
			.run();

		const updated = await this.db
			.prepare("SELECT * FROM tech_stacks WHERE id = ?1")
			.bind(id)
			.first<TechStackRow>();
		return this.mapRow(updated!);
	}

	/**
	 * @description Delete a tech stack.
	 * @param { number } id Tech stack id
	 * @returns { Promise<boolean> } True if a row was removed
	 */
	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM tech_stacks WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Map a DB row to the public TechStack shape (snake_case → camelCase).
	 * @param { TechStackRow } row Raw DB row
	 * @returns { TechStack } Public tech stack
	 */
	private mapRow(row: TechStackRow): TechStack {
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			url: row.url,
			logoUrl: row.logo_url,
			cover: row.cover,
			status: row.status === 0 ? 0 : 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
