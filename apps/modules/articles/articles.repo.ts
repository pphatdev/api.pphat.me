import { Author, Author as AuthorRow, Tag, PaginatedResult, PaginationParams } from "../../shared/interfaces";
import type { Article, IArticleRepository, ArticleRow, CreateArticleDto, UpdateArticleDto } from "./articles.interface";

function computeReadingMins(content: string): number {
	const words = content.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 200));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ArticleRepository implements IArticleRepository {
	constructor(private readonly db: D1Database) { }

	async findAll({ page, limit, search, sort, order, tags, authors }: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Article>> {
		const ALLOWED_SORT = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		const sortCols = (sort?.length ? sort : ['created_at']);
		const orderBy = sortCols
			.map(col => `${ALLOWED_SORT.includes(col) ? col : 'created_at'} ${safeOrder}`)
			.join(', ');
		const offset = (page - 1) * limit;

		const conditions: string[] = ['1=1'];
		const bindings: unknown[] = [];
		let idx = 1;

		if (onlyPublished) {
			conditions.push('published = 1');
		}

		if (search) {
			const like = `%${search}%`;
			conditions.push(`(title LIKE ?${idx} OR slug LIKE ?${idx + 1} OR description LIKE ?${idx + 2})`);
			bindings.push(like, like, like);
			idx += 3;
		}

		if (tags?.length) {
			const placeholders = tags.map((_, i) => `?${idx + i}`).join(', ');
			conditions.push(`id IN (SELECT article_id FROM tags WHERE tag IN (${placeholders}) AND article_id IS NOT NULL)`);
			bindings.push(...tags);
			idx += tags.length;
		}

		if (authors?.length) {
			const placeholders = authors.map((_, i) => `?${idx + i}`).join(', ');
			conditions.push(`id IN (SELECT aa.article_id FROM article_authors aa JOIN authors au ON au.id = aa.author_id WHERE au.name IN (${placeholders}))`);
			bindings.push(...authors);
			idx += authors.length;
		}

		const where = conditions.join(' AND ');

		const [dataResult, countRow] = await Promise.all([
			this.db
				.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
				.bind(...bindings, limit, offset)
				.all<ArticleRow>(),
			this.db
				.prepare(`SELECT COUNT(*) as count FROM articles WHERE ${where}`)
				.bind(...bindings)
				.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;
		const data = await Promise.all((dataResult.results as ArticleRow[]).map((row) => this.hydrate(row)));

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

	async findAllByAuthor(authorId: number, { page, limit, search, sort, order }: PaginationParams, onlyPublished: boolean): Promise<PaginatedResult<Article>> {
		const ALLOWED_SORT_COLS = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		const sortCols = (sort?.length ? sort : ['created_at']);
		const orderBy = sortCols
			.map(col => `a.${ALLOWED_SORT_COLS.includes(col) ? col : 'created_at'} ${safeOrder}`)
			.join(', ');
		const offset = (page - 1) * limit;
		const publishedFilter = onlyPublished ? 'AND a.published = 1' : '';

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT a.* FROM articles a JOIN article_authors aa ON aa.article_id = a.id WHERE aa.author_id = ?1 AND (a.title LIKE ?2 OR a.slug LIKE ?3 OR a.description LIKE ?4) ${publishedFilter} ORDER BY ${orderBy} LIMIT ?5 OFFSET ?6`)
					.bind(authorId, like, like, like, limit, offset)
					.all<ArticleRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM articles a JOIN article_authors aa ON aa.article_id = a.id WHERE aa.author_id = ?1 AND (a.title LIKE ?2 OR a.slug LIKE ?3 OR a.description LIKE ?4) ${publishedFilter}`)
					.bind(authorId, like, like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT a.* FROM articles a JOIN article_authors aa ON aa.article_id = a.id WHERE aa.author_id = ?1 ${publishedFilter} ORDER BY ${orderBy} LIMIT ?2 OFFSET ?3`)
					.bind(authorId, limit, offset)
					.all<ArticleRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM articles a JOIN article_authors aa ON aa.article_id = a.id WHERE aa.author_id = ?1 ${publishedFilter}`)
					.bind(authorId)
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const data = await Promise.all((dataResult.results as ArticleRow[]).map((row) => this.hydrate(row)));

		return {
			data,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	async findBySlug(slug: string): Promise<Article | null> {
		const row = await this.db
			.prepare("SELECT * FROM articles WHERE slug = ?1")
			.bind(slug)
			.first<ArticleRow>();

		if (!row) return null;
		return this.hydrateWithStats(row);
	}

	async getNextSlug(currentSlug: string): Promise<string | null> {
		const row = await this.db
			.prepare("SELECT created_at FROM articles WHERE slug = ?1")
			.bind(currentSlug)
			.first<{ created_at: string }>();

		if (!row) return null;

		const result = await this.db
			.prepare("SELECT slug FROM articles WHERE created_at > ?1 ORDER BY created_at ASC LIMIT 1")
			.bind(row.created_at)
			.first<{ slug: string }>();

		return result?.slug ?? null;
	}

	async getPrevSlug(currentSlug: string): Promise<string | null> {
		const row = await this.db
			.prepare("SELECT created_at FROM articles WHERE slug = ?1")
			.bind(currentSlug)
			.first<{ created_at: string }>();

		if (!row) return null;

		const result = await this.db
			.prepare("SELECT slug FROM articles WHERE created_at < ?1 ORDER BY created_at DESC LIMIT 1")
			.bind(row.created_at)
			.first<{ slug: string }>();

		return result?.slug ?? null;
	}

	async findById(id: string): Promise<Article | null> {
		if (!UUID_RE.test(id)) return null;
		const row = await this.db
			.prepare("SELECT * FROM articles WHERE id = ?1")
			.bind(id)
			.first<ArticleRow>();

		if (!row) return null;
		return this.hydrateWithStats(row);
	}

	async create(dto: CreateArticleDto): Promise<Article> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db
			.prepare(
				"INSERT INTO articles (id, title, slug, description, thumbnail, content, file_path, published, owner_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
			)
			.bind(id, dto.title, dto.slug, dto.description, dto.thumbnail ?? "", dto.content ?? "", dto.file_path ?? "", dto.published ? 1 : 0, dto.owner_id ?? null, now, now)
			.run();

		if (dto.author_ids?.length) {
			await this.db.batch(
				dto.author_ids.map((aid) =>
					this.db.prepare("INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)").bind(id, aid)
				)
			);
		}

		if (dto.tags?.length) {
			await this.db.batch(
				dto.tags.map((t) =>
					this.db.prepare("INSERT INTO tags (tag, description, article_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", id)
				)
			);
		}
		// Initialize article_stats
		const readingMins = computeReadingMins(dto.content ?? "");
		await this.db
			.prepare("INSERT OR IGNORE INTO article_stats (article_id, views, reading_mins) VALUES (?1, 0, ?2)")
			.bind(id, readingMins)
			.run();
		const row = await this.db.prepare("SELECT * FROM articles WHERE id = ?1").bind(id).first<ArticleRow>();
		return this.hydrate(row!);
	}

	async update(id: string, dto: UpdateArticleDto): Promise<Article | null> {
		const existing = await this.db
			.prepare("SELECT * FROM articles WHERE id = ?1")
			.bind(id)
			.first<ArticleRow>();

		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.title !== undefined) { fields.push(`title = ?${idx++}`); values.push(dto.title); }
		if (dto.slug !== undefined) { fields.push(`slug = ?${idx++}`); values.push(dto.slug); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.thumbnail !== undefined) { fields.push(`thumbnail = ?${idx++}`); values.push(dto.thumbnail); }
		if (dto.content !== undefined) {
			fields.push(`content = ?${idx++}`);
			values.push(dto.content);
		}
		if (dto.file_path !== undefined) { fields.push(`file_path = ?${idx++}`); values.push(dto.file_path); }
		if (dto.published !== undefined) { fields.push(`published = ?${idx++}`); values.push(dto.published ? 1 : 0); }

		fields.push(`updated_at = ?${idx++}`);
		values.push(new Date().toISOString());
		values.push(existing.id);

		await this.db
			.prepare(`UPDATE articles SET ${fields.join(", ")} WHERE id = ?${idx}`)
			.bind(...values)
			.run();

		if (dto.author_ids !== undefined) {
			await this.db.prepare("DELETE FROM article_authors WHERE article_id = ?1").bind(existing.id).run();
			if (dto.author_ids.length) {
				await this.db.batch(
					dto.author_ids.map((aid) =>
						this.db.prepare("INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)").bind(existing.id, aid)
					)
				);
			}
		}

		if (dto.tags !== undefined) {
			await this.db.prepare("DELETE FROM tags WHERE article_id = ?1").bind(existing.id).run();
			if (dto.tags.length) {
				await this.db.batch(
					dto.tags.map((t) =>
						this.db.prepare("INSERT INTO tags (tag, description, article_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", existing.id)
					)
				);
			}
		}

		// Update reading_mins if content changed
		if (dto.content !== undefined) {
			const readingMins = computeReadingMins(dto.content);
			await this.db
				.prepare("UPDATE article_stats SET reading_mins = ?1 WHERE article_id = ?2")
				.bind(readingMins, existing.id)
				.run();
		}

		const updated = await this.db.prepare("SELECT * FROM articles WHERE id = ?1").bind(existing.id).first<ArticleRow>();
		return this.hydrate(updated!);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM articles WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	async isOwner(articleId: string, userId: string): Promise<boolean> {
		const row = await this.db
			.prepare("SELECT 1 FROM articles WHERE id = ?1 AND owner_id = ?2")
			.bind(articleId, userId)
			.first();
		return row !== null;
	}

	async isContributor(articleId: string, userId: string): Promise<boolean> {
		const row = await this.db
			.prepare("SELECT 1 FROM article_contributors WHERE article_id = ?1 AND user_id = ?2")
			.bind(articleId, userId)
			.first();
		return row !== null;
	}

	async addContributor(articleId: string, userId: string): Promise<void> {
		await this.db
			.prepare("INSERT OR IGNORE INTO article_contributors (article_id, user_id) VALUES (?1, ?2)")
			.bind(articleId, userId)
			.run();
	}

	async removeContributor(articleId: string, userId: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM article_contributors WHERE article_id = ?1 AND user_id = ?2")
			.bind(articleId, userId)
			.run();
		return result.meta.changes > 0;
	}

	private async hydrateWithStats(row: ArticleRow): Promise<Article> {
		const [article, statsRow, reactionsResult] = await Promise.all([
			this.hydrate(row),
			this.db
				.prepare("SELECT views, reading_mins FROM article_stats WHERE article_id = ?1")
				.bind(row.id)
				.first<{ views: number; reading_mins: number }>(),
			this.db
				.prepare("SELECT type, count FROM article_reactions WHERE article_id = ?1 ORDER BY count DESC")
				.bind(row.id)
				.all<{ type: string; count: number }>(),
		]);

		if (statsRow) {
			article.stats = { views: statsRow.views, readingMins: statsRow.reading_mins };
		}

		if (reactionsResult.results.length > 0) {
			article.reactions = reactionsResult.results;
		}

		return article;
	}

	private async hydrate(row: ArticleRow): Promise<Article> {
		const [authorsResult, tagsResult] = await Promise.all([
			this.db
				.prepare(
					"SELECT a.name, a.profile, a.url FROM article_authors aa JOIN authors a ON aa.author_id = a.id WHERE aa.article_id = ?1"
				)
				.bind(row.id)
				.all<AuthorRow>(),
			this.db
				.prepare("SELECT id, tag, description FROM tags WHERE article_id = ?1")
				.bind(row.id)
				.all<Tag>(),
		]);

		const authors: Author[] = authorsResult.results.map((a) => ({
			name: a.name,
			profile: a.profile,
			url: a.url,
		}));

		const tags: Tag[] = tagsResult.results;

		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			description: row.description,
			tags,
			authors,
			thumbnail: row.thumbnail,
			published: row.published === 1,
			ownerId: row.owner_id,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			content: row.content,
			filePath: row.file_path,
		};
	}
}

