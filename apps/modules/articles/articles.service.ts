import { Article, IArticleRepository, CreateArticleDto, UpdateArticleDto } from "./articles.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ListArticles {
	constructor(private readonly articleRepository: IArticleRepository) {}

	execute(params: PaginationParams): Promise<PaginatedResult<Article>> {
		return this.articleRepository.findAll(params);
	}
}

export class GetArticleBySlug {
	constructor(private readonly articleRepository: IArticleRepository) {}

	execute(slug: string): Promise<Article | null> {
		return this.articleRepository.findBySlug(slug);
	}
}

export class CreateArticle {
	constructor(private readonly articleRepository: IArticleRepository) {}

	execute(dto: CreateArticleDto): Promise<Article> {
		return this.articleRepository.create(dto);
	}
}

export class UpdateArticle {
	constructor(private readonly articleRepository: IArticleRepository) {}

	execute(slug: string, dto: UpdateArticleDto): Promise<Article | null> {
		return this.articleRepository.update(slug, dto);
	}
}

export class DeleteArticle {
	constructor(private readonly articleRepository: IArticleRepository) {}

	execute(slug: string): Promise<boolean> {
		return this.articleRepository.delete(slug);
	}
}