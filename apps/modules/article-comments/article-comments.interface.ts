import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export interface ArticleComment {
	id: number;
	articleId: string;
	authorName: string;
	content: string;
	createdAt: string;
	updatedAt: string;
}

export interface ArticleCommentRow {
	id: number;
	article_id: string;
	author_name: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface CreateCommentDto {
	authorName: string;
	content: string;
}

export interface UpdateCommentDto {
	content: string;
}

export interface IArticleCommentRepository {
	findAllByArticleId(articleId: string, params: PaginationParams): Promise<PaginatedResult<ArticleComment>>;
	findById(id: number): Promise<ArticleComment | null>;
	create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment>;
	update(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null>;
	delete(id: number): Promise<boolean>;
}
