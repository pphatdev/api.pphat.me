export interface ArticleReaction {
	id: number;
	articleId: string;
	type: string;
	count: number;
}

export interface ArticleReactionRow {
	id: number;
	article_id: string;
	type: string;
	count: number;
}

export interface IArticleReactionRepository {
	findAllByArticleId(articleId: string): Promise<ArticleReaction[]>;
	/**
	 * Record a user's reaction if it does not already exist and bump the
	 * aggregate count only on first insert. Repeat calls by the same user
	 * for the same (article, type) are idempotent.
	 */
	increment(articleId: string, type: string, userId: string): Promise<ArticleReaction>;
	/**
	 * Remove the user's per-user marker if present; only then decrement the
	 * aggregate count. Repeat calls after removal are no-ops.
	 */
	decrement(articleId: string, type: string, userId: string): Promise<ArticleReaction | null>;
}
