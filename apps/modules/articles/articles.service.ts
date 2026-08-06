import { Article, IArticleRepository, UpdateArticleDto } from "./articles.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleService {
	constructor(private readonly repo: IArticleRepository) {}

	/**
	 * @description List all articles
	 * @param { PaginationParams } params Pagination parameters (includes optional `status`)
	 * @param { boolean } [onlyPublished=true] Whether to only list published articles
	 * @param { object } [opts] Auth context (admin unlocks full-list + status filter)
	 * @returns { Promise<PaginatedResult<Article>> } Paginated articles
	 */
	list(params: PaginationParams, onlyPublished = true, opts?: { admin?: boolean }): Promise<PaginatedResult<Article>> {
		return this.repo.findAll(params, onlyPublished, opts);
	}

	/**
	 * @description List articles by author ID. Row-level visibility filter:
	 * admin sees everything; a signed-in caller sees their own drafts + all
	 * public rows; anonymous callers see only public rows.
	 * @param { number } authorId The author ID
	 * @param { PaginationParams } params Pagination parameters
	 * @param { object } [opts] Auth context (admin flag + viewer user id)
	 * @returns { Promise<PaginatedResult<Article>> } Paginated articles
	 */
	listByAuthor(
		authorId: number,
		params: PaginationParams,
		opts?: { admin?: boolean; viewerUserId?: string | null },
	): Promise<PaginatedResult<Article>> {
		return this.repo.findAllByAuthor(authorId, params, opts);
	}

	/**
	 * @description Get an article by its slug
	 * @param { string } slug The article slug
	 * @returns { Promise<Article | null> } The article or null
	 */
	getBySlug(slug: string): Promise<Article | null> {
		return this.repo.findBySlug(slug);
	}

	/**
	 * @description Get an article by its ID
	 * @param { string } id The article ID
	 * @returns { Promise<Article | null> } The article or null
	 */
	getById(id: string): Promise<Article | null> {
		return this.repo.findById(id);
	}

	/**
	 * @description Update an existing article
	 * @param { string } id The article ID
	 * @param { UpdateArticleDto } dto Update data
	 * @returns { Promise<Article | null> } The updated article or null
	 */
	update(id: string, dto: UpdateArticleDto): Promise<Article | null> {
		return this.repo.update(id, dto);
	}

	/**
	 * @description Delete an article
	 * @param { string } id The article ID
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(id: string): Promise<boolean> {
		return this.repo.delete(id);
	}

	/**
	 * @description Remove a contributor from an article
	 * @param { string } articleId The article ID
	 * @param { string } userId The user ID
	 * @returns { Promise<boolean> } True if removed
	 */
	removeContributor(articleId: string, userId: string): Promise<boolean> {
		return this.repo.removeContributor(articleId, userId);
	}
}