import type { ArticleReaction, IArticleReactionRepository } from "./article-reactions.interface";

export class ArticleReactionService {
	constructor(private readonly repo: IArticleReactionRepository) {}

	list(articleId: string): Promise<ArticleReaction[]> {
		return this.repo.findAllByArticleId(articleId);
	}

	increment(articleId: string, type: string): Promise<ArticleReaction> {
		return this.repo.increment(articleId, type);
	}

	decrement(articleId: string, type: string): Promise<ArticleReaction | null> {
		return this.repo.decrement(articleId, type);
	}

	delete(articleId: string, type: string): Promise<boolean> {
		return this.repo.delete(articleId, type);
	}
}
