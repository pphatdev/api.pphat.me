export interface ArticleStats {
	articleId: string;
	views: number;
	readingMins: number;
}

export interface ArticleStatsRow {
	article_id: string;
	views: number;
	reading_mins: number;
}

export interface IArticleStatsRepository {
	findByArticleId(articleId: string): Promise<ArticleStats | null>;
	/**
	 * Increment the article's view count IF this user has not already viewed
	 * it today (UTC calendar day). Idempotent per (article, user, day).
	 */
	incrementViews(articleId: string, userId: string): Promise<ArticleStats>;
}
