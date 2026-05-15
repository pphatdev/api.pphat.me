import type { ArticleStats, IArticleStatsRepository } from "./article-stats.interface";

export class ArticleStatsService {
	constructor(private readonly repo: IArticleStatsRepository) {}

	/**
	 * @description Get stats for an article
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleStats | null> } The article stats or null
	 */
	get(articleId: string): Promise<ArticleStats | null> {
		return this.repo.findByArticleId(articleId);
	}

	/**
	 * @description Increment view count for an article
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleStats> } The updated stats
	 */
	incrementViews(articleId: string): Promise<ArticleStats> {
		return this.repo.incrementViews(articleId);
	}
}
