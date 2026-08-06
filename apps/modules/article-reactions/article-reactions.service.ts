import type { ArticleReaction, IArticleReactionRepository } from "./article-reactions.interface";

export class ArticleReactionService {
	constructor(private readonly repo: IArticleReactionRepository) {}

	/**
	 * @description List reactions for an article
	 * @param { string } articleId The article ID
	 * @returns { Promise<ArticleReaction[]> } List of reactions
	 */
	list(articleId: string): Promise<ArticleReaction[]> {
		return this.repo.findAllByArticleId(articleId);
	}

	/**
	 * @description Increment a reaction count (idempotent per user).
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @param { string } userId The reacting user ID
	 * @returns { Promise<ArticleReaction> } The updated reaction
	 */
	increment(articleId: string, type: string, userId: string): Promise<ArticleReaction> {
		return this.repo.increment(articleId, type, userId);
	}

	/**
	 * @description Decrement a reaction count (only if the user had voted).
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @param { string } userId The reacting user ID
	 * @returns { Promise<ArticleReaction | null> } The updated reaction or null if removed
	 */
	decrement(articleId: string, type: string, userId: string): Promise<ArticleReaction | null> {
		return this.repo.decrement(articleId, type, userId);
	}
}
