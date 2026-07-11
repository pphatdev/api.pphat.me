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
	 * @description Increment a reaction count
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<ArticleReaction> } The updated reaction
	 */
	increment(articleId: string, type: string): Promise<ArticleReaction> {
		return this.repo.increment(articleId, type);
	}

	/**
	 * @description Decrement a reaction count
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<ArticleReaction | null> } The updated reaction or null if removed
	 */
	decrement(articleId: string, type: string): Promise<ArticleReaction | null> {
		return this.repo.decrement(articleId, type);
	}

	/**
	 * @description Delete a reaction entry
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(articleId: string, type: string): Promise<boolean> {
		return this.repo.delete(articleId, type);
	}
}
