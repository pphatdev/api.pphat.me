import type { ArticleStats, IArticleStatsRepository, ViewResult } from "./article-stats.interface";

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
	 * @description Increment view count for an article (idempotent per user + day).
	 * @param { string } articleId The article ID
	 * @param { string } userId The viewing user ID
	 * @returns { Promise<ArticleStats> } The updated stats
	 */
	incrementViews(articleId: string, userId: string): Promise<ArticleStats> {
		return this.repo.incrementViews(articleId, userId);
	}

	/**
	 * @description Increment view count for an anonymous visitor (idempotent per visitor + day).
	 * @param { string } articleId The article ID
	 * @param { string } visitorHash Opaque per-day visitor hash
	 * @returns { Promise<ViewResult> } Current stats and whether this call counted
	 */
	incrementVisitorViews(articleId: string, visitorHash: string): Promise<ViewResult> {
		return this.repo.incrementVisitorViews(articleId, visitorHash);
	}
}
