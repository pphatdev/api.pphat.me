import type { Skill, SkillJoinedRow, CreateSkillDto, ISkillRepository, UpdateSkillDto, SkillLevel } from "./skills.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class SkillRepository implements ISkillRepository {
	constructor(private readonly db: D1Database) { }

	private static readonly SELECT_WITH_JOIN =
		`SELECT s.id, s.tech_stack_id, s.level, s.years_of_experience, s.description, s.sort_order, s.status, s.created_at, s.updated_at,
		        ts.name AS ts_name, ts.logo_url AS ts_logo_url, ts.cover AS ts_cover, ts.url AS ts_url
		 FROM skills s
		 JOIN tech_stacks ts ON ts.id = s.tech_stack_id`;

	/**
	 * @description List skills, joined with tech_stacks for icon/image.
	 * Default order: sort_order ASC, then tech stack name ASC — so the admin
	 * can arrange a resume list manually and ties fall back to alphabetical.
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<Skill>> } Paginated skills
	 */
	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Skill>> {
		const ALLOWED_SORT_MAP: Record<string, string> = {
			id: 's.id',
			level: 's.level',
			sort_order: 's.sort_order',
			status: 's.status',
			created_at: 's.created_at',
			updated_at: 's.updated_at',
			name: 'ts.name',
		};
		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const chosen = sort?.[0] && ALLOWED_SORT_MAP[sort[0]];
		const orderBy = chosen ? `${chosen} ${safeOrder}` : `s.sort_order ASC, ts.name ASC`;
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${SkillRepository.SELECT_WITH_JOIN} WHERE (ts.name LIKE ?1 OR s.description LIKE ?2) ORDER BY ${orderBy} LIMIT ?3 OFFSET ?4`)
					.bind(like, like, limit, offset)
					.all<SkillJoinedRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM skills s JOIN tech_stacks ts ON ts.id = s.tech_stack_id WHERE (ts.name LIKE ?1 OR s.description LIKE ?2)")
					.bind(like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${SkillRepository.SELECT_WITH_JOIN} ORDER BY ${orderBy} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<SkillJoinedRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM skills")
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		return {
			data: (dataResult.results as SkillJoinedRow[]).map(this.mapRow),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/**
	 * @description Find a skill by id, joined with its tech stack.
	 */
	async findById(id: number): Promise<Skill | null> {
		const row = await this.db
			.prepare(`${SkillRepository.SELECT_WITH_JOIN} WHERE s.id = ?1`)
			.bind(id)
			.first<SkillJoinedRow>();
		return row ? this.mapRow(row) : null;
	}

	/**
	 * @description Create a skill referencing a tech stack.
	 */
	async create(dto: CreateSkillDto): Promise<Skill> {
		const now = new Date().toISOString();
		const level: SkillLevel = dto.level ?? 'intermediate';
		const status = dto.status === 0 ? 0 : 1;
		const sortOrder = Number.isInteger(dto.sort_order) ? dto.sort_order! : 0;

		const result = await this.db
			.prepare(
				"INSERT INTO skills (tech_stack_id, level, years_of_experience, description, sort_order, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
			)
			.bind(
				dto.tech_stack_id,
				level,
				dto.years_of_experience ?? null,
				dto.description ?? '',
				sortOrder,
				status,
				now,
				now,
			)
			.run();

		const id = result.meta.last_row_id as number;
		return (await this.findById(id))!;
	}

	/**
	 * @description Partial update — only provided fields change.
	 */
	async update(id: number, dto: UpdateSkillDto): Promise<Skill | null> {
		const existing = await this.db
			.prepare("SELECT id FROM skills WHERE id = ?1")
			.bind(id)
			.first<{ id: number }>();
		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.tech_stack_id !== undefined) { fields.push(`tech_stack_id = ?${idx++}`); values.push(dto.tech_stack_id); }
		if (dto.level !== undefined) { fields.push(`level = ?${idx++}`); values.push(dto.level); }
		// years_of_experience accepts null to clear.
		if (dto.years_of_experience !== undefined) { fields.push(`years_of_experience = ?${idx++}`); values.push(dto.years_of_experience); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.sort_order !== undefined) { fields.push(`sort_order = ?${idx++}`); values.push(dto.sort_order); }
		if (dto.status !== undefined) { fields.push(`status = ?${idx++}`); values.push(dto.status === 0 ? 0 : 1); }

		if (fields.length === 0) return this.findById(id);

		fields.push(`updated_at = ?${idx}`);
		values.push(new Date().toISOString());
		values.push(id);

		await this.db
			.prepare(`UPDATE skills SET ${fields.join(", ")} WHERE id = ?${idx + 1}`)
			.bind(...values)
			.run();

		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM skills WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Map the JOINed row to the public Skill shape with
	 * embedded techStack (icon, image, url).
	 */
	private mapRow(row: SkillJoinedRow): Skill {
		return {
			id: row.id,
			techStack: {
				id: row.tech_stack_id,
				name: row.ts_name,
				icon: row.ts_logo_url,
				image: row.ts_cover,
				url: row.ts_url,
			},
			level: row.level,
			yearsOfExperience: row.years_of_experience ?? null,
			description: row.description,
			sortOrder: row.sort_order,
			status: row.status === 0 ? 0 : 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
