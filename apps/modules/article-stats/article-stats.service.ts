import type { ArticleStats, IArticleStatsRepository } from "./article-stats.interface";

export class ArticleStatsService {
	constructor(private readonly repo: IArticleStatsRepository) {}

	get(articleId: string): Promise<ArticleStats | null> {
		return this.repo.findByArticleId(articleId);
	}

	incrementViews(articleId: string): Promise<ArticleStats> {
		return this.repo.incrementViews(articleId);
	}
}
