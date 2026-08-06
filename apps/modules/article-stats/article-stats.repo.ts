import type { ArticleStats, ArticleStatsRow, IArticleStatsRepository } from "./article-stats.interface";

export class ArticleStatsRepository implements IArticleStatsRepository {
	constructor(private readonly db: D1Database) {}

	/**
	 * @description Find stats by article ID
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleStats | null> } The article stats or null
	 */
	async findByArticleId(articleId: string): Promise<ArticleStats | null> {
		const row = await this.db
			.prepare("SELECT * FROM article_stats WHERE article_id = ?1")
			.bind(articleId)
			.first<ArticleStatsRow>();
		if (!row) return null;
		return this.mapRow(row);
	}

	/**
	 * @description Increment view count IFF this user has not already viewed
	 * the article today. Same user, same article, same day = no double-count.
	 * @param { string } articleId The article ID
	 * @param { string } userId The viewing user ID
	 * @returns { Promise<ArticleStats> } The current stats row (unchanged on duplicate)
	 */
	async incrementViews(articleId: string, userId: string): Promise<ArticleStats> {
		// UTC calendar day marker; keeps deduplication windows aligned with
		// the natural day boundary rather than a rolling 24h clock.
		const insert = await this.db
			.prepare(
				"INSERT OR IGNORE INTO article_view_event (article_id, user_id, day) VALUES (?1, ?2, date('now'))",
			)
			.bind(articleId, userId)
			.run();

		if ((insert.meta?.changes ?? 0) > 0) {
			await this.db
				.prepare(
					"INSERT INTO article_stats (article_id, views, reading_mins) VALUES (?1, 1, 0) ON CONFLICT(article_id) DO UPDATE SET views = views + 1",
				)
				.bind(articleId)
				.run();
		}

		const row = await this.db
			.prepare("SELECT * FROM article_stats WHERE article_id = ?1")
			.bind(articleId)
			.first<ArticleStatsRow>();
		// Guarantee a row exists even for an article that has never been viewed
		// (returns zeros so the client can render the stats block).
		if (!row) return { articleId, views: 0, readingMins: 0 };
		return this.mapRow(row);
	}

	/**
	 * @description Maps a database row to a stats object
	 * @param { ArticleStatsRow } row The database row
	 * @returns { ArticleStats } The mapped stats
	 */
	private mapRow(row: ArticleStatsRow): ArticleStats {
		return {
			articleId: row.article_id,
			views: row.views,
			readingMins: row.reading_mins,
		};
	}
}
