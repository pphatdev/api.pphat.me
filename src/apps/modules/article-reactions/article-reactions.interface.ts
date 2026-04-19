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
	increment(articleId: string, type: string): Promise<ArticleReaction>;
	decrement(articleId: string, type: string): Promise<ArticleReaction | null>;
	delete(articleId: string, type: string): Promise<boolean>;
}
