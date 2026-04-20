import type { ArticleComment, CreateCommentDto, IArticleCommentRepository, UpdateCommentDto } from "./article-comments.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ListArticleComments {
	constructor(private readonly repo: IArticleCommentRepository) {}
	execute(articleId: string, params: PaginationParams): Promise<PaginatedResult<ArticleComment>> {
		return this.repo.findAllByArticleId(articleId, params);
	}
}

export class CreateArticleComment {
	constructor(private readonly repo: IArticleCommentRepository) {}
	execute(articleId: string, dto: CreateCommentDto): Promise<ArticleComment> {
		return this.repo.create(articleId, dto);
	}
}

export class UpdateArticleComment {
	constructor(private readonly repo: IArticleCommentRepository) {}
	execute(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null> {
		return this.repo.update(id, dto);
	}
}

export class DeleteArticleComment {
	constructor(private readonly repo: IArticleCommentRepository) {}
	execute(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
