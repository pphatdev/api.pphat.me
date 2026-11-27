import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export interface ArticleComment {
	id: number;
	articleId: string;
	userId: string | null;
	/** The top-level comment this replies to; null for a top-level comment. */
	parentId: number | null;
	authorName: string;
	content: string;
	createdAt: string;
	updatedAt: string;
}

/** A top-level comment with its replies (oldest first). */
export interface ArticleCommentThread extends ArticleComment {
	replies: ArticleComment[];
}

export interface ArticleCommentRow {
	id: number;
	article_id: string;
	user_id: string | null;
	parent_id?: number | null;
	author_name: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface CreateCommentDto {
	authorName: string;
	content: string;
	userId: string;
	/** Top-level comment being replied to. */
	parentId?: number | null;
}

export interface UpdateCommentDto {
	content: string;
}

export interface IArticleCommentRepository {
	findAllByArticleId(articleId: string, params: PaginationParams): Promise<PaginatedResult<ArticleCommentThread>>;
	findById(id: number): Promise<ArticleComment | null>;
	create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment>;
	update(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null>;
	delete(id: number): Promise<boolean>;
}
