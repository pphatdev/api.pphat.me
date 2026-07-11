import type { ArticleComment, CreateCommentDto, IArticleCommentRepository, UpdateCommentDto } from "./article-comments.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleCommentService {
	constructor(private readonly repo: IArticleCommentRepository) {}

	/**
	 * @description List comments for an article
	 * @param { string } articleId The article ID
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<ArticleComment>> } Paginated comments
	 */
	list(articleId: string, params: PaginationParams): Promise<PaginatedResult<ArticleComment>> {
		return this.repo.findAllByArticleId(articleId, params);
	}

	/**
	 * @description Create a new comment
	 * @param { string } articleId The article ID
	 * @param { CreateCommentDto } dto Comment data
	 * @returns { Promise<ArticleComment> } The created comment
	 */
	create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment> {
		return this.repo.create(articleId, dto);
	}

	/**
	 * @description Update an existing comment
	 * @param { number } id The comment ID
	 * @param { UpdateCommentDto } dto Update data
	 * @returns { Promise<ArticleComment | null> } The updated comment or null
	 */
	update(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null> {
		return this.repo.update(id, dto);
	}

	/**
	 * @description Delete a comment
	 * @param { number } id The comment ID
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
