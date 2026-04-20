import type { ArticleReaction, IArticleReactionRepository } from "./article-reactions.interface";

export class ListArticleReactions {
	constructor(private readonly repo: IArticleReactionRepository) {}
	execute(articleId: string): Promise<ArticleReaction[]> {
		return this.repo.findAllByArticleId(articleId);
	}
}

export class IncrementArticleReaction {
	constructor(private readonly repo: IArticleReactionRepository) {}
	execute(articleId: string, type: string): Promise<ArticleReaction> {
		return this.repo.increment(articleId, type);
	}
}

export class DecrementArticleReaction {
	constructor(private readonly repo: IArticleReactionRepository) {}
	execute(articleId: string, type: string): Promise<ArticleReaction | null> {
		return this.repo.decrement(articleId, type);
	}
}

export class DeleteArticleReaction {
	constructor(private readonly repo: IArticleReactionRepository) {}
	execute(articleId: string, type: string): Promise<boolean> {
		return this.repo.delete(articleId, type);
	}
}
