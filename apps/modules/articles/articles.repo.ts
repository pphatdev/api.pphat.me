import { PaginatedResult, PaginationParams } from "../../shared/interfaces";
import { Tag } from "../tags/tags.interface";
import { Author, AuthorRow, AuthorDetailRow } from "../authors/authors.interface";

import { getNextSlug, getPrevSlug, buildUpdateFields, buildListConditions, getStatsSummary, mapAuthorRow } from "../../shared/helpers/repo";
import type { Article, IArticleRepository, ArticleRow, CreateArticleDto, UpdateArticleDto } from "./articles.interface";

function computeReadingMins(content: string): number {
	const words = content.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 200));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ArticleRepository implements IArticleRepository {
	constructor(private readonly db: D1Database) { }

	async findAll(params: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Article>> {
		const { page, limit, sort, order } = params;
		const offset = (page - 1) * limit;
		const { conditions, bindings, nextIdx } = this.buildConditions(params, onlyPublished);
		const orderBy = this.buildOrderBy(sort, order);
		const where = conditions.join(' AND ');

		const [dataResult, countRow] = await Promise.all([
			this.db
				.prepare(`SELECT * FROM articles WHERE ${where} ORDER BY ${orderBy} LIMIT ?${nextIdx} OFFSET ?${nextIdx + 1}`)
				.bind(...bindings, limit, offset)
				.all<ArticleRow>(),
			this.db
				.prepare(`SELECT COUNT(*) as count FROM articles WHERE ${where}`)
				.bind(...bindings)
				.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;
		const data = await Promise.all((dataResult.results as ArticleRow[]).map((row) => this.hydrate(row, { includeContent: false })));

		return {
			data,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	private buildOrderBy(sort: string[] | undefined, order: 'asc' | 'desc' | undefined): string {
		const ALLOWED_SORT = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		const sortCols = (sort?.length ? sort : ['created_at']);
		return sortCols
			.map(col => `${ALLOWED_SORT.includes(col) ? col : 'created_at'} ${safeOrder}`)
			.join(', ');
	}

	private buildConditions(params: PaginationParams, onlyPublished: boolean) {
		const { search, tags, authors } = params;
		let { conditions, bindings, nextIdx } = buildListConditions(search, onlyPublished);

		if (tags?.length) {
			const placeholders = tags.map((_, i) => `?${nextIdx + i}`).join(', ');
			conditions.push(`id IN (SELECT article_id FROM tags WHERE tag IN (${placeholders}) AND article_id IS NOT NULL)`);
			bindings.push(...tags);
			nextIdx += tags.length;
		}

		if (authors?.length) {
			const placeholders = authors.map((_, i) => `?${nextIdx + i}`).join(', ');
			conditions.push(`id IN (SELECT aa.article_id FROM article_authors aa JOIN authors au ON au.id = aa.author_id WHERE au.name IN (${placeholders}))`);
			bindings.push(...authors);
			nextIdx += authors.length;
		}

		return { conditions, bindings, nextIdx };
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
		const data = await Promise.all((dataResult.results as ArticleRow[]).map((row) => this.hydrate(row, { includeContent: false })));

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
		return getNextSlug(this.db, 'articles', currentSlug);
	}

	async getPrevSlug(currentSlug: string): Promise<string | null> {
		return getPrevSlug(this.db, 'articles', currentSlug);
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

		await this.insertArticle(id, dto, now);

		if (dto.author_ids?.length) await this.updateAuthors(id, dto.author_ids);
		if (dto.tags?.length) await this.updateTags(id, dto.tags);

		await this.initStats(id, dto.content || "");

		return (await this.findById(id))!;
	}

	private async insertArticle(id: string, dto: CreateArticleDto, now: string): Promise<void> {
		await this.db
			.prepare(
				"INSERT INTO articles (id, title, slug, description, thumbnail, content, file_path, published, owner_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
			)
			.bind(id, dto.title, dto.slug, dto.description, dto.thumbnail ?? "", dto.content ?? "", dto.file_path ?? "", dto.published ? 1 : 0, dto.owner_id ?? null, now, now)
			.run();
	}

	private async initStats(id: string, content: string): Promise<void> {
		const readingMins = computeReadingMins(content);
		await this.db
			.prepare("INSERT OR IGNORE INTO article_stats (article_id, views, reading_mins) VALUES (?1, 0, ?2)")
			.bind(id, readingMins)
			.run();
	}

	async update(id: string, dto: UpdateArticleDto): Promise<Article | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		const mappings: [keyof UpdateArticleDto, string, ((v: any) => any)?][] = [
			['title', 'title'],
			['slug', 'slug'],
			['description', 'description'],
			['thumbnail', 'thumbnail'],
			['content', 'content'],
			['file_path', 'file_path'],
			['published', 'published', (v) => (v ? 1 : 0)],
		];

		const { fields, values, nextIdx } = buildUpdateFields(dto, mappings);

		if (fields.length > 0) {
			fields.push(`updated_at = ?${nextIdx}`);
			values.push(new Date().toISOString());
			values.push(id);
			await this.db.prepare(`UPDATE articles SET ${fields.join(", ")} WHERE id = ?${nextIdx + 1}`).bind(...values).run();
		}

		if (dto.author_ids !== undefined) await this.updateAuthors(id, dto.author_ids);
		if (dto.tags !== undefined) await this.updateTags(id, dto.tags);
		if (dto.content !== undefined) await this.updateReadingMins(id, dto.content);

		return this.findById(id);
	}

	private async updateAuthors(articleId: string, authorIds: number[]): Promise<void> {
		await this.db.prepare("DELETE FROM article_authors WHERE article_id = ?1").bind(articleId).run();
		if (authorIds.length > 0) {
			await this.db.batch(
				authorIds.map((aid) =>
					this.db.prepare("INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)").bind(articleId, aid)
				)
			);
		}
	}

	private async updateTags(articleId: string, tags: { tag: string; description?: string }[]): Promise<void> {
		await this.db.prepare("DELETE FROM tags WHERE article_id = ?1").bind(articleId).run();
		if (tags.length > 0) {
			await this.db.batch(
				tags.map((t) =>
					this.db.prepare("INSERT INTO tags (tag, description, article_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", articleId)
				)
			);
		}
	}

	private async updateReadingMins(articleId: string, content: string): Promise<void> {
		const mins = computeReadingMins(content);
		await this.db.prepare("UPDATE article_stats SET reading_mins = ?1 WHERE article_id = ?2").bind(mins, articleId).run();
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

	async findTop(limit: number): Promise<Article[]> {
		const result = await this.db
			.prepare(`
				SELECT a.* 
				FROM articles a 
				JOIN article_stats s ON a.id = s.article_id 
				WHERE a.published = 1 
				ORDER BY s.views DESC 
				LIMIT ?1
			`)
			.bind(limit)
			.all<ArticleRow>();

		return Promise.all((result.results as ArticleRow[]).map(row => this.hydrate(row, { includeContent: false })));
	}

	async getStatsSummary(): Promise<{ total: number; published: number; draft: number }> {
		return getStatsSummary(this.db, 'articles');
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

	public async hydrate(row: ArticleRow, options: { includeContent?: boolean } = { includeContent: true }): Promise<Article> {
		const [authorsResult, tagsResult] = await Promise.all([
			this.db
				.prepare(
					"SELECT a.id, a.name, a.profile, a.url, ad.bio, ad.avatar_url, ad.social_links, ad.status, ad.created_at, ad.updated_at FROM article_authors aa JOIN authors a ON aa.author_id = a.id LEFT JOIN author_details ad ON a.id = ad.author_id WHERE aa.article_id = ?1"
				)
				.bind(row.id)
				.all<AuthorRow & AuthorDetailRow>(),
			this.db
				.prepare("SELECT id, tag, description FROM tags WHERE article_id = ?1")
				.bind(row.id)
				.all<Tag>(),
		]);

		const authors: Author[] = authorsResult.results.map((a: any) => mapAuthorRow(a));

		const tags: Tag[] = tagsResult.results;

		const article: Article = {
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
			filePath: row.file_path,
		};

		if (options.includeContent !== false) {
			article.content = row.content;
		}

		return article;
	}
}

