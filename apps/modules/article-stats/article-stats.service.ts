import type { ArticleStats, IArticleStatsRepository } from "./article-stats.interface";

export class GetArticleStats {
	constructor(private readonly repo: IArticleStatsRepository) {}
	execute(articleId: string): Promise<ArticleStats | null> {
		return this.repo.findByArticleId(articleId);
	}
}

export class IncrementArticleViews {
	constructor(private readonly repo: IArticleStatsRepository) {}
	execute(articleId: string): Promise<ArticleStats> {
		return this.repo.incrementViews(articleId);
	}
}
