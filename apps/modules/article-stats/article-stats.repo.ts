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
	 * @description Increment view count in the database
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleStats> } The updated stats
	 */
	async incrementViews(articleId: string): Promise<ArticleStats> {
		await this.db
			.prepare(
				"INSERT INTO article_stats (article_id, views, reading_mins) VALUES (?1, 1, 0) ON CONFLICT(article_id) DO UPDATE SET views = views + 1"
			)
			.bind(articleId)
			.run();
		const row = await this.db
			.prepare("SELECT * FROM article_stats WHERE article_id = ?1")
			.bind(articleId)
			.first<ArticleStatsRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Upsert stats (reading time)
	 * @param { string } articleId The article ID
	 * @param { number } readingMins Estimated reading time in minutes
	 * @returns { Promise<void> }
	 */
	async upsert(articleId: string, readingMins: number): Promise<void> {
		await this.db
			.prepare(
				"INSERT INTO article_stats (article_id, views, reading_mins) VALUES (?1, 0, ?2) ON CONFLICT(article_id) DO UPDATE SET reading_mins = excluded.reading_mins"
			)
			.bind(articleId, readingMins)
			.run();
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
