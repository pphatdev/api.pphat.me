import type { Tag, TagRow, CreateTagDto, ITagRepository, UpdateTagDto } from "./tags.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class TagRepository implements ITagRepository {
	constructor(private readonly db: D1Database) {}

	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Tag>> {
		const ALLOWED_SORT = ['id', 'tag', 'description'];
		const safeSort = ALLOWED_SORT.includes(sort ?? '') ? sort! : 'id';
		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM tags WHERE (tag LIKE ?1 OR description LIKE ?2) ORDER BY ${safeSort} ${safeOrder} LIMIT ?3 OFFSET ?4`)
					.bind(like, like, limit, offset)
					.all<TagRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM tags WHERE (tag LIKE ?1 OR description LIKE ?2)")
					.bind(like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM tags ORDER BY ${safeSort} ${safeOrder} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<TagRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM tags")
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;

		return {
			data: (dataResult.results as TagRow[]).map(this.mapRow),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async findById(id: number): Promise<Tag | null> {
		const row = await this.db
			.prepare("SELECT * FROM tags WHERE id = ?1")
			.bind(id)
			.first<TagRow>();

		if (!row) return null;
		return this.mapRow(row);
	}

	async findByArticleId(articleId: string): Promise<Tag[]> {
		const result = await this.db
			.prepare("SELECT * FROM tags WHERE article_id = ?1 ORDER BY id ASC")
			.bind(articleId)
			.all<TagRow>();
		return (result.results as TagRow[]).map(this.mapRow);
	}

	async findByProjectId(projectId: string): Promise<Tag[]> {
		const result = await this.db
			.prepare("SELECT * FROM tags WHERE project_id = ?1 ORDER BY id ASC")
			.bind(projectId)
			.all<TagRow>();
		return (result.results as TagRow[]).map(this.mapRow);
	}

	async create(dto: CreateTagDto): Promise<Tag> {
		const result = await this.db
			.prepare("INSERT INTO tags (tag, description, article_id, project_id) VALUES (?1, ?2, ?3, ?4)")
			.bind(dto.tag, dto.description ?? "", dto.article_id ?? null, dto.project_id ?? null)
			.run();

		const id = result.meta.last_row_id as number;
		const row = await this.db
			.prepare("SELECT * FROM tags WHERE id = ?1")
			.bind(id)
			.first<TagRow>();

		return this.mapRow(row!);
	}

	async update(id: number, dto: UpdateTagDto): Promise<Tag | null> {
		const existing = await this.db
			.prepare("SELECT * FROM tags WHERE id = ?1")
			.bind(id)
			.first<TagRow>();

		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.tag !== undefined) { fields.push(`tag = ?${idx++}`); values.push(dto.tag); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.article_id !== undefined) { fields.push(`article_id = ?${idx++}`); values.push(dto.article_id); }
		if (dto.project_id !== undefined) { fields.push(`project_id = ?${idx++}`); values.push(dto.project_id); }

		if (!fields.length) return this.mapRow(existing);

		values.push(id);
		await this.db
			.prepare(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?${idx}`)
			.bind(...values)
			.run();

		const updated = await this.db
			.prepare("SELECT * FROM tags WHERE id = ?1")
			.bind(id)
			.first<TagRow>();

		return this.mapRow(updated!);
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM tags WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	private mapRow(row: TagRow): Tag {
		return {
			id: row.id,
			tag: row.tag,
			description: row.description,
			article_id: row.article_id,
			project_id: row.project_id,
		};
	}
}
