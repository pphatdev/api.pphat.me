import { PaginatedResult, PaginationParams } from "../../shared/interfaces";
import type {
	ArticleComment,
	ArticleCommentRow,
	ArticleCommentThread,
	CreateCommentDto,
	IArticleCommentRepository,
	UpdateCommentDto,
} from "./article-comments.interface";

export class ArticleCommentRepository implements IArticleCommentRepository {
	constructor(private readonly db: D1Database) {}

	/**
	 * @description Top-level comments for an article (newest first, paginated),
	 * each with all its replies (oldest first). `total` counts threads.
	 * @param { string } articleId The article ID
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<ArticleCommentThread>> } Paginated threads
	 */
	async findAllByArticleId(articleId: string, { page, limit }: PaginationParams): Promise<PaginatedResult<ArticleCommentThread>> {
		const offset = (page - 1) * limit;

		const [{ results }, countRow] = await Promise.all([
			this.db
				.prepare("SELECT * FROM article_comments WHERE article_id = ?1 AND parent_id IS NULL ORDER BY created_at DESC LIMIT ?2 OFFSET ?3")
				.bind(articleId, limit, offset)
				.all<ArticleCommentRow>(),
			this.db
				.prepare("SELECT COUNT(*) as count FROM article_comments WHERE article_id = ?1 AND parent_id IS NULL")
				.bind(articleId)
				.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;
		const replies = await this.findReplies(articleId, results.map((r) => r.id));

		return {
			data: results.map((row) => ({ ...this.mapRow(row), replies: replies.get(row.id) ?? [] })),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * @description Replies to the given top-level comments, grouped by parent
	 * @param { string } articleId The article ID
	 * @param { number[] } parentIds Top-level comment IDs
	 * @returns { Promise<Map<number, ArticleComment[]>> }
	 */
	private async findReplies(articleId: string, parentIds: number[]): Promise<Map<number, ArticleComment[]>> {
		const byParent = new Map<number, ArticleComment[]>();
		if (!parentIds.length) return byParent;
		const placeholders = parentIds.map((_, i) => `?${i + 2}`).join(', ');
		const { results } = await this.db
			.prepare(`SELECT * FROM article_comments WHERE article_id = ?1 AND parent_id IN (${placeholders}) ORDER BY created_at ASC`)
			.bind(articleId, ...parentIds)
			.all<ArticleCommentRow>();
		for (const row of results ?? []) {
			const list = byParent.get(row.parent_id!) ?? [];
			list.push(this.mapRow(row));
			byParent.set(row.parent_id!, list);
		}
		return byParent;
	}

	/**
	 * @description Create a new comment in the database
	 * @param { string } articleId The article ID
	 * @param { CreateCommentDto } dto Comment data
	 * @returns { Promise<ArticleComment> } The created comment
	 */
	async create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment> {
		const now = new Date().toISOString();
		const result = await this.db
			.prepare(
				"INSERT INTO article_comments (article_id, user_id, parent_id, author_name, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
			)
			.bind(articleId, dto.userId, dto.parentId ?? null, dto.authorName, dto.content, now, now)
			.run();
		const id = result.meta.last_row_id as number;
		const row = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Find a comment by its ID
	 * @param { number } id The comment ID
	 * @returns { Promise<ArticleComment | null> } The comment or null
	 */
	async findById(id: number): Promise<ArticleComment | null> {
		const row = await this.db
			.prepare("SELECT * FROM article_comments WHERE id = ?1")
			.bind(id)
			.first<ArticleCommentRow>();
		return row ? this.mapRow(row) : null;
	}

	/**
	 * @description Update a comment in the database
	 * @param { number } id The comment ID
	 * @param { UpdateCommentDto } dto Update data
	 * @returns { Promise<ArticleComment | null> } The updated comment or null
	 */
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

	/**
	 * @description Delete a comment from the database
	 * @param { number } id The comment ID
	 * @returns { Promise<boolean> } True if changes occurred
	 */
	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM article_comments WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Maps a database row to a comment object
	 * @param { ArticleCommentRow } row The database row
	 * @returns { ArticleComment } The mapped comment
	 */
	private mapRow(row: ArticleCommentRow): ArticleComment {
		return {
			id: row.id,
			articleId: row.article_id,
			userId: row.user_id ?? null,
			parentId: row.parent_id ?? null,
			authorName: row.author_name,
			content: row.content,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
