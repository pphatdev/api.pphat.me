import type { ITagRepository, CreateTagDto, UpdateTagDto, Tag } from "./tags.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class TagService {
	constructor(private readonly repo: ITagRepository) {}

	list(params: PaginationParams): Promise<PaginatedResult<Tag>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<Tag | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateTagDto): Promise<Tag> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateTagDto): Promise<Tag | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}

	listByArticle(articleId: string): Promise<Tag[]> {
		return this.repo.findByArticleId(articleId);
	}

	listByProject(projectId: string): Promise<Tag[]> {
		return this.repo.findByProjectId(projectId);
	}
}
