export interface ArticleStats {
	articleId: string;
	views: number;
	readingMins: number;
}

/** Result of a view-count attempt: the current stats plus whether this call counted. */
export interface ViewResult extends ArticleStats {
	counted: boolean;
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
	/**
	 * Increment the view count IF this anonymous visitor (opaque daily hash)
	 * has not already viewed the article today. Idempotent per
	 * (article, visitor_hash, day).
	 */
	incrementVisitorViews(articleId: string, visitorHash: string): Promise<ViewResult>;
}
