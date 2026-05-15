import type { ArticleReaction, ArticleReactionRow, IArticleReactionRepository } from "./article-reactions.interface";

export class ArticleReactionRepository implements IArticleReactionRepository {
	constructor(private readonly db: D1Database) {}

	/**
	 * @description Find all reactions for an article
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleReaction[]> } List of reactions
	 */
	async findAllByArticleId(articleId: string): Promise<ArticleReaction[]> {
		const { results } = await this.db
			.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 ORDER BY count DESC")
			.bind(articleId)
			.all<ArticleReactionRow>();
		return results.map(this.mapRow);
	}

	/**
	 * @description Increment a reaction count in the database
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<ArticleReaction> } The updated reaction
	 */
	async increment(articleId: string, type: string): Promise<ArticleReaction> {
		await this.db
			.prepare(
				"INSERT INTO article_reactions (article_id, type, count) VALUES (?1, ?2, 1) ON CONFLICT(article_id, type) DO UPDATE SET count = count + 1"
			)
			.bind(articleId, type)
			.run();
		const row = await this.db
			.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.first<ArticleReactionRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Decrement a reaction count in the database
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<ArticleReaction | null> } The updated reaction or null if removed
	 */
	async decrement(articleId: string, type: string): Promise<ArticleReaction | null> {
		const existing = await this.db
			.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.first<ArticleReactionRow>();
		if (!existing) return null;

		if (existing.count <= 1) {
			await this.db
				.prepare("DELETE FROM article_reactions WHERE article_id = ?1 AND type = ?2")
				.bind(articleId, type)
				.run();
			return null;
		}

		await this.db
			.prepare("UPDATE article_reactions SET count = count - 1 WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.run();
		const row = await this.db
			.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.first<ArticleReactionRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Delete a reaction from the database
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<boolean> } True if changes occurred
	 */
	async delete(articleId: string, type: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM article_reactions WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Maps a database row to a reaction object
	 * @param { ArticleReactionRow } row The database row
	 * @returns { ArticleReaction } The mapped reaction
	 */
	private mapRow(row: ArticleReactionRow): ArticleReaction {
		return {
			id: row.id,
			articleId: row.article_id,
			type: row.type,
			count: row.count,
		};
	}
}
