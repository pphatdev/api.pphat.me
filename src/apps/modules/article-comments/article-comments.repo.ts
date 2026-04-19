import { PaginatedResult, PaginationParams } from "../../../shared/interfaces";
import type {
	ArticleComment,
	ArticleCommentRow,
	CreateCommentDto,
	IArticleCommentRepository,
	UpdateCommentDto,
} from "./article-comments.interface";

export class ArticleCommentRepository implements IArticleCommentRepository {
	constructor(private readonly db: D1Database) {}

	async findAllByArticleId(articleId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<ArticleComment>> {
		const offset = (page - 1) * limit;

		const [{ results }, countRow] = await Promise.all([
			this.db
				.prepare("SELECT * FROM article_comments WHERE article_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3")
				.bind(articleId, limit, offset)
				.all<ArticleCommentRow>(),
			this.db
				.prepare("SELECT COUNT(*) as count FROM article_comments WHERE article_id = ?1")
				.bind(articleId)
				.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;

		return {
			data: results.map(this.mapRow),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async findById(id: number): Promise<ArticleComment | null> {
		const row = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		if (!row) return null;
		return this.mapRow(row);
	}

	async create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment> {
		const now = new Date().toISOString();
		const result = await this.db
			.prepare(
				"INSERT INTO article_comments (article_id, author_name, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)"
			)
			.bind(articleId, dto.authorName, dto.content, now, now)
			.run();
		const id = result.meta.last_row_id as number;
		const row = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		return this.mapRow(row!);
	}

	async update(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null> {
		const existing = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		if (!existing) return null;

		await this.db
			.prepare("UPDATE article_comments SET content = ?1, updated_at = ?2 WHERE id = ?3")
			.bind(dto.content, new Date().toISOString(), id)
			.run();

		const row = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		return this.mapRow(row!);
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM article_comments WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	private mapRow(row: ArticleCommentRow): ArticleComment {
		return {
			id: row.id,
			articleId: row.article_id,
			authorName: row.author_name,
			content: row.content,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
