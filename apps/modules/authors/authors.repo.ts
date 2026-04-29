import type {
	Author,
	AuthorDetailRow,
	AuthorRow,
	CreateAuthorDto,
	IAuthorRepository,
	UpdateAuthorDto,
} from "./authors.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class AuthorRepository implements IAuthorRepository {
	constructor(private readonly db: D1Database) {}

	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Author>> {
		const ALLOWED_SORT = ['id', 'name', 'profile', 'url'];
		const safeSort = sort?.[0] && ALLOWED_SORT.includes(sort[0]) ? sort[0] : 'id';
		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM authors WHERE name LIKE ?1 ORDER BY ${safeSort} ${safeOrder} LIMIT ?2 OFFSET ?3`)
					.bind(like, limit, offset)
					.all<AuthorRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM authors WHERE name LIKE ?1")
					.bind(like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM authors ORDER BY ${safeSort} ${safeOrder} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<AuthorRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM authors")
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const data = await Promise.all((dataResult.results as AuthorRow[]).map((row) => this.hydrate(row)));

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async findById(id: number): Promise<Author | null> {
		const row = await this.db
			.prepare("SELECT * FROM authors WHERE id = ?1")
			.bind(id)
			.first<AuthorRow>();

		if (!row) return null;
		return this.hydrate(row);
	}

	async create(dto: CreateAuthorDto): Promise<Author> {
		const result = await this.db
			.prepare("INSERT INTO authors (name, profile, url) VALUES (?1, ?2, ?3)")
			.bind(dto.name, dto.profile ?? "", dto.url ?? "")
			.run();

		const id = result.meta.last_row_id as number;
		const now = new Date().toISOString();

		await this.db
			.prepare(
				"INSERT INTO author_details (author_id, bio, avatar_url, social_links, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
			)
			.bind(
				id,
				dto.bio ?? "",
				dto.avatar_url ?? "",
				JSON.stringify(dto.social_links ?? []),
				dto.status ?? 0,
				now,
				now
			)
			.run();

		const row = await this.db
			.prepare("SELECT * FROM authors WHERE id = ?1")
			.bind(id)
			.first<AuthorRow>();

		return this.hydrate(row!);
	}

	async update(id: number, dto: UpdateAuthorDto): Promise<Author | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		await this.updateAuthorTable(id, dto);
		await this.updateDetailsTable(id, dto);

		return this.findById(id);
	}

	private async updateAuthorTable(id: number, dto: UpdateAuthorDto): Promise<void> {
		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.name !== undefined) { fields.push(`name = ?${idx++}`); values.push(dto.name); }
		if (dto.profile !== undefined) { fields.push(`profile = ?${idx++}`); values.push(dto.profile); }
		if (dto.url !== undefined) { fields.push(`url = ?${idx++}`); values.push(dto.url); }

		if (fields.length > 0) {
			values.push(id);
			await this.db.prepare(`UPDATE authors SET ${fields.join(", ")} WHERE id = ?${idx}`).bind(...values).run();
		}
	}

	private async updateDetailsTable(id: number, dto: UpdateAuthorDto): Promise<void> {
		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.bio !== undefined) { fields.push(`bio = ?${idx++}`); values.push(dto.bio); }
		if (dto.avatar_url !== undefined) { fields.push(`avatar_url = ?${idx++}`); values.push(dto.avatar_url); }
		if (dto.social_links !== undefined) { fields.push(`social_links = ?${idx++}`); values.push(JSON.stringify(dto.social_links)); }
		if (dto.status !== undefined) { fields.push(`status = ?${idx++}`); values.push(dto.status); }

		fields.push(`updated_at = ?${idx++}`);
		values.push(new Date().toISOString());
		values.push(id);

		await this.db.prepare(`UPDATE author_details SET ${fields.join(", ")} WHERE author_id = ?${idx}`).bind(...values).run();
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM authors WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	private async hydrate(row: AuthorRow): Promise<Author> {
		const detail = await this.db
			.prepare("SELECT bio, avatar_url, social_links, status, created_at, updated_at FROM author_details WHERE author_id = ?1")
			.bind(row.id)
			.first<AuthorDetailRow>();

		return this.mapToAuthor(row, detail);
	}

	private mapToAuthor(row: AuthorRow, detail: AuthorDetailRow | null): Author {
		if (!detail) {
			return {
				id: row.id, name: row.name, profile: row.profile, url: row.url,
				bio: "", avatarUrl: "", socialLinks: [], status: 0, createdAt: "", updatedAt: ""
			};
		}
		return {
			id: row.id,
			name: row.name,
			profile: row.profile,
			url: row.url,
			bio: detail.bio || "",
			avatarUrl: detail.avatar_url || "",
			socialLinks: this.parseSocialLinks(detail.social_links),
			status: detail.status || 0,
			createdAt: detail.created_at || "",
			updatedAt: detail.updated_at || "",
		};
	}

	private parseSocialLinks(links: string | undefined): string[] {
		if (!links) return [];
		try {
			return JSON.parse(links);
		} catch {
			return [];
		}
	}
}
