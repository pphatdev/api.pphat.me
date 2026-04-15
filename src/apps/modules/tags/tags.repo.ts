import type { Tag, TagRow, CreateTagDto, ITagRepository, UpdateTagDto } from "./tags.interface";

export class TagRepository implements ITagRepository {
	constructor(private readonly db: D1Database) {}

	async findAll(): Promise<Tag[]> {
		const { results } = await this.db
			.prepare("SELECT * FROM tags ORDER BY id ASC")
			.all<TagRow>();

		return results.map(this.mapRow);
	}

	async findById(id: number): Promise<Tag | null> {
		const row = await this.db
			.prepare("SELECT * FROM tags WHERE id = ?1")
			.bind(id)
			.first<TagRow>();

		if (!row) return null;
		return this.mapRow(row);
	}

	async create(dto: CreateTagDto): Promise<Tag> {
		const result = await this.db
			.prepare("INSERT INTO tags (tag, description) VALUES (?1, ?2)")
			.bind(dto.tag, dto.description ?? "")
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
		};
	}
}
