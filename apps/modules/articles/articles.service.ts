import { Article, IArticleRepository, CreateArticleDto, UpdateArticleDto } from "./articles.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleService {
	constructor(private readonly repo: IArticleRepository) {}

	list(params: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Article>> {
		return this.repo.findAll(params, onlyPublished);
	}

	listByAuthor(authorId: number, params: PaginationParams, onlyPublished: boolean): Promise<PaginatedResult<Article>> {
		return this.repo.findAllByAuthor(authorId, params, onlyPublished);
	}

	getBySlug(slug: string): Promise<Article | null> {
		return this.repo.findBySlug(slug);
	}

	getById(id: string): Promise<Article | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateArticleDto): Promise<Article> {
		return this.repo.create(dto);
	}

	update(id: string, dto: UpdateArticleDto): Promise<Article | null> {
		return this.repo.update(id, dto);
	}

	delete(id: string): Promise<boolean> {
		return this.repo.delete(id);
	}

	isOwner(articleId: string, userId: string): Promise<boolean> {
		return this.repo.isOwner(articleId, userId);
	}

	isContributor(articleId: string, userId: string): Promise<boolean> {
		return this.repo.isContributor(articleId, userId);
	}

	addContributor(articleId: string, userId: string): Promise<void> {
		return this.repo.addContributor(articleId, userId);
	}

	removeContributor(articleId: string, userId: string): Promise<boolean> {
		return this.repo.removeContributor(articleId, userId);
	}
}