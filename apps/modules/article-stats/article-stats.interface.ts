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
	incrementViews(articleId: string): Promise<ArticleStats>;
	upsert(articleId: string, readingMins: number): Promise<void>;
}
