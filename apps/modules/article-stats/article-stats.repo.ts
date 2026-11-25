import type { ArticleStats, ArticleStatsRow, IArticleStatsRepository, ViewResult } from "./article-stats.interface";

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
	 * @description Increment view count IFF this anonymous visitor has not
	 * already viewed the article today. The marker insert and the counter
	 * bump run in one D1 batch (a single transaction); the bump is guarded by
	 * `changes() > 0`, so a duplicate marker leaves the counter untouched.
	 * @param { string } articleId The article ID
	 * @param { string } visitorHash Opaque per-day visitor hash
	 * @returns { Promise<ViewResult> } Current stats and whether this call counted
	 */
	async incrementVisitorViews(articleId: string, visitorHash: string): Promise<ViewResult> {
		const [insert] = await this.db.batch([
			this.db
				.prepare("INSERT OR IGNORE INTO article_view_visitor (article_id, visitor_hash, day) VALUES (?1, ?2, date('now'))")
				.bind(articleId, visitorHash),
			this.db
				.prepare(
					"INSERT INTO article_stats (article_id, views, reading_mins) SELECT ?1, 1, 0 WHERE changes() > 0 ON CONFLICT(article_id) DO UPDATE SET views = views + 1",
				)
				.bind(articleId),
		]);
		const counted = (insert?.meta?.changes ?? 0) > 0;
		const stats = (await this.findByArticleId(articleId)) ?? { articleId, views: 0, readingMins: 0 };
		return { ...stats, counted };
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
