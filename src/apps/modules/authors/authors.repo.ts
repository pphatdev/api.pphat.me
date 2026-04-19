import type {
	Author,
	AuthorDetailRow,
	AuthorRow,
	CreateAuthorDto,
	IAuthorRepository,
	UpdateAuthorDto,
} from "./authors.interface";
import { PaginatedResult, PaginationParams } from "../../../shared/interfaces";

export class AuthorRepository implements IAuthorRepository {
	constructor(private readonly db: D1Database) {}

	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Author>> {
		const ALLOWED_SORT = ['id', 'name', 'profile', 'url'];
		const safeSort = ALLOWED_SORT.includes(sort ?? '') ? sort! : 'id';
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
		const existing = await this.db
			.prepare("SELECT * FROM authors WHERE id = ?1")
			.bind(id)
			.first<AuthorRow>();

		if (!existing) return null;

		const authorFields: string[] = [];
		const authorValues: unknown[] = [];
		let idx = 1;

		if (dto.name !== undefined) { authorFields.push(`name = ?${idx++}`); authorValues.push(dto.name); }
		if (dto.profile !== undefined) { authorFields.push(`profile = ?${idx++}`); authorValues.push(dto.profile); }
		if (dto.url !== undefined) { authorFields.push(`url = ?${idx++}`); authorValues.push(dto.url); }

		if (authorFields.length) {
			authorValues.push(id);
			await this.db
				.prepare(`UPDATE authors SET ${authorFields.join(", ")} WHERE id = ?${idx}`)
				.bind(...authorValues)
				.run();
		}

		const detailFields: string[] = [];
		const detailValues: unknown[] = [];
		let didx = 1;

		if (dto.bio !== undefined) { detailFields.push(`bio = ?${didx++}`); detailValues.push(dto.bio); }
		if (dto.avatar_url !== undefined) { detailFields.push(`avatar_url = ?${didx++}`); detailValues.push(dto.avatar_url); }
		if (dto.social_links !== undefined) { detailFields.push(`social_links = ?${didx++}`); detailValues.push(JSON.stringify(dto.social_links)); }
		if (dto.status !== undefined) { detailFields.push(`status = ?${didx++}`); detailValues.push(dto.status); }

		detailFields.push(`updated_at = ?${didx++}`);
		detailValues.push(new Date().toISOString());
		detailValues.push(id);

		await this.db
			.prepare(`UPDATE author_details SET ${detailFields.join(", ")} WHERE author_id = ?${didx}`)
			.bind(...detailValues)
			.run();

		const updated = await this.db
			.prepare("SELECT * FROM authors WHERE id = ?1")
			.bind(id)
			.first<AuthorRow>();

		return this.hydrate(updated!);
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

		let socialLinks: string[] = [];
		if (detail?.social_links) {
			try {
				socialLinks = JSON.parse(detail.social_links);
			} catch {
				socialLinks = [];
			}
		}

		return {
			id: row.id,
			name: row.name,
			profile: row.profile,
			url: row.url,
			bio: detail?.bio ?? "",
			avatarUrl: detail?.avatar_url ?? "",
			socialLinks,
			status: detail?.status ?? 0,
			createdAt: detail?.created_at ?? "",
			updatedAt: detail?.updated_at ?? "",
		};
	}
}
