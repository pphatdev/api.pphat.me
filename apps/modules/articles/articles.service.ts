import { Article, IArticleRepository, CreateArticleDto, UpdateArticleDto } from "./articles.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleService {
	constructor(private readonly repo: IArticleRepository) {}

	/**
	 * @description List all articles
	 * @param { PaginationParams } params Pagination parameters
	 * @param { boolean } [onlyPublished=true] Whether to only list published articles
	 * @returns { Promise<PaginatedResult<Article>> } Paginated articles
	 */
	list(params: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Article>> {
		return this.repo.findAll(params, onlyPublished);
	}

	/**
	 * @description List articles by author ID
	 * @param { number } authorId The author ID
	 * @param { PaginationParams } params Pagination parameters
	 * @param { boolean } onlyPublished Whether to only list published articles
	 * @returns { Promise<PaginatedResult<Article>> } Paginated articles
	 */
	listByAuthor(authorId: number, params: PaginationParams, onlyPublished: boolean): Promise<PaginatedResult<Article>> {
		return this.repo.findAllByAuthor(authorId, params, onlyPublished);
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
	 * @description Create a new article
	 * @param { CreateArticleDto } dto Article data
	 * @returns { Promise<Article> } The created article
	 */
	create(dto: CreateArticleDto): Promise<Article> {
		return this.repo.create(dto);
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
	 * @description Check if a user is the owner of an article
	 * @param { string } articleId The article ID
	 * @param { string } userId The user ID
	 * @returns { boolean } True if owner
	 */
	isOwner(articleId: string, userId: string): Promise<boolean> {
		return this.repo.isOwner(articleId, userId);
	}

	/**
	 * @description Check if a user is a contributor to an article
	 * @param { string } articleId The article ID
	 * @param { string } userId The user ID
	 * @returns { boolean } True if contributor
	 */
	isContributor(articleId: string, userId: string): Promise<boolean> {
		return this.repo.isContributor(articleId, userId);
	}

	/**
	 * @description Add a contributor to an article
	 * @param { string } articleId The article ID
	 * @param { string } userId The user ID
	 * @returns { Promise<void> }
	 */
	addContributor(articleId: string, userId: string): Promise<void> {
		return this.repo.addContributor(articleId, userId);
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