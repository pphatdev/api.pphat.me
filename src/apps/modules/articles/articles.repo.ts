import { Author, Author as AuthorRow, TagRow } from "../../../shared/interfaces";
import type { Article, IArticleRepository, ArticleRow, CreateArticleDto, UpdateArticleDto } from "./articles.interface";


export class ArticleRepository implements IArticleRepository {
	constructor(private readonly db: D1Database) {}

	async findAll(): Promise<Article[]> {
		const { results } = await this.db
			.prepare("SELECT * FROM articles ORDER BY created_at DESC")
			.all<ArticleRow>();

		return Promise.all(results.map((row) => this.hydrate(row)));
	}

	async findBySlug(slug: string): Promise<Article | null> {
		const row = await this.db
			.prepare("SELECT * FROM articles WHERE slug = ?1")
			.bind(slug)
			.first<ArticleRow>();

		if (!row) return null;
		return this.hydrate(row);
	}

	async create(dto: CreateArticleDto): Promise<Article> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db
			.prepare(
				"INSERT INTO articles (id, title, slug, description, thumbnail, content, file_path, published, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
			)
			.bind(id, dto.title, dto.slug, dto.description, dto.thumbnail ?? "", dto.content ?? "", dto.file_path ?? "", dto.published ? 1 : 0, now, now)
			.run();

		if (dto.author_ids?.length) {
			await this.db.batch(
				dto.author_ids.map((aid) =>
					this.db.prepare("INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)").bind(id, aid)
				)
			);
		}

		if (dto.tag_ids?.length) {
			await this.db.batch(
				dto.tag_ids.map((tid) =>
					this.db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?1, ?2)").bind(id, tid)
				)
			);
		}

		const row = await this.db.prepare("SELECT * FROM articles WHERE id = ?1").bind(id).first<ArticleRow>();
		return this.hydrate(row!);
	}

	async update(slug: string, dto: UpdateArticleDto): Promise<Article | null> {
		const existing = await this.db
			.prepare("SELECT * FROM articles WHERE slug = ?1")
			.bind(slug)
			.first<ArticleRow>();

		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.title !== undefined) { fields.push(`title = ?${idx++}`); values.push(dto.title); }
		if (dto.slug !== undefined) { fields.push(`slug = ?${idx++}`); values.push(dto.slug); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.thumbnail !== undefined) { fields.push(`thumbnail = ?${idx++}`); values.push(dto.thumbnail); }
		if (dto.content !== undefined) { fields.push(`content = ?${idx++}`); values.push(dto.content); }
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

		if (dto.tag_ids !== undefined) {
			await this.db.prepare("DELETE FROM article_tags WHERE article_id = ?1").bind(existing.id).run();
			if (dto.tag_ids.length) {
				await this.db.batch(
					dto.tag_ids.map((tid) =>
						this.db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?1, ?2)").bind(existing.id, tid)
					)
				);
			}
		}

		const newSlug = dto.slug ?? slug;
		const updated = await this.db.prepare("SELECT * FROM articles WHERE slug = ?1").bind(newSlug).first<ArticleRow>();
		return this.hydrate(updated!);
	}

	async delete(slug: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM articles WHERE slug = ?1")
			.bind(slug)
			.run();
		return result.meta.changes > 0;
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
				.prepare(
					"SELECT t.tag FROM article_tags at JOIN tags t ON at.tag_id = t.id WHERE at.article_id = ?1"
				)
				.bind(row.id)
				.all<TagRow>(),
		]);

		const authors: Author[] = authorsResult.results.map((a) => ({
			name: a.name,
			profile: a.profile,
			url: a.url,
		}));

		const tags: string[] = tagsResult.results.map((t) => t.tag);

		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			description: row.description,
			tags,
			authors,
			thumbnail: row.thumbnail,
			published: row.published === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			content: row.content,
			filePath: row.file_path,
		};
	}
}
