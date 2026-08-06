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
	 * @description Record a user's reaction and bump the aggregate count only
	 * if this is their first vote for this (article, type). Repeat votes are
	 * silently absorbed (returns current count).
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @param { string } userId The reacting user ID
	 * @returns { Promise<ArticleReaction> } The current reaction row
	 */
	async increment(articleId: string, type: string, userId: string): Promise<ArticleReaction> {
		const insert = await this.db
			.prepare("INSERT OR IGNORE INTO article_reaction_user (article_id, type, user_id) VALUES (?1, ?2, ?3)")
			.bind(articleId, type, userId)
			.run();

		if ((insert.meta?.changes ?? 0) > 0) {
			await this.db
				.prepare(
					"INSERT INTO article_reactions (article_id, type, count) VALUES (?1, ?2, 1) ON CONFLICT(article_id, type) DO UPDATE SET count = count + 1",
				)
				.bind(articleId, type)
				.run();
		}

		const row = await this.db
			.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 AND type = ?2")
			.bind(articleId, type)
			.first<ArticleReactionRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Remove a user's reaction. Only decrements the aggregate
	 * count if their per-user marker actually existed; repeat calls are
	 * no-ops. Returns the current reaction row, or null when the count hits
	 * zero (row deleted).
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @param { string } userId The reacting user ID
	 * @returns { Promise<ArticleReaction | null> }
	 */
	async decrement(articleId: string, type: string, userId: string): Promise<ArticleReaction | null> {
		const remove = await this.db
			.prepare("DELETE FROM article_reaction_user WHERE article_id = ?1 AND type = ?2 AND user_id = ?3")
			.bind(articleId, type, userId)
			.run();

		if ((remove.meta?.changes ?? 0) === 0) {
			// The user never voted (or already un-voted). Return the current row
			// unchanged so the caller can render the aggregate.
			const row = await this.db
				.prepare("SELECT * FROM article_reactions WHERE article_id = ?1 AND type = ?2")
				.bind(articleId, type)
				.first<ArticleReactionRow>();
			return row ? this.mapRow(row) : null;
		}

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
