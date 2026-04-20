import type { ArticleComment, CreateCommentDto, IArticleCommentRepository, UpdateCommentDto } from "./article-comments.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ArticleCommentService {
	constructor(private readonly repo: IArticleCommentRepository) {}

	list(articleId: string, params: PaginationParams): Promise<PaginatedResult<ArticleComment>> {
		return this.repo.findAllByArticleId(articleId, params);
	}

	create(articleId: string, dto: CreateCommentDto): Promise<ArticleComment> {
		return this.repo.create(articleId, dto);
	}

	update(id: number, dto: UpdateCommentDto): Promise<ArticleComment | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
