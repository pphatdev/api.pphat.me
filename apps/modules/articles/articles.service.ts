import { Article, IArticleRepository, CreateArticleDto, UpdateArticleDto } from "./articles.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleService {
	constructor(private readonly repo: IArticleRepository) {}

	list(params: PaginationParams): Promise<PaginatedResult<Article>> {
		return this.repo.findAll(params);
	}

	getBySlug(slug: string): Promise<Article | null> {
		return this.repo.findBySlug(slug);
	}

	create(dto: CreateArticleDto): Promise<Article> {
		return this.repo.create(dto);
	}

	update(slug: string, dto: UpdateArticleDto): Promise<Article | null> {
		return this.repo.update(slug, dto);
	}

	delete(slug: string): Promise<boolean> {
		return this.repo.delete(slug);
	}
}