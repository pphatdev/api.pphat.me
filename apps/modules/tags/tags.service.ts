import type { ITagRepository, CreateTagDto, UpdateTagDto, Tag } from "./tags.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class TagService {
	constructor(private readonly repo: ITagRepository) {}

	/**
	 * @description List all tags
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<Tag>> } Paginated tags
	 */
	list(params: PaginationParams): Promise<PaginatedResult<Tag>> {
		return this.repo.findAll(params);
	}

	/**
	 * @description Get a tag by ID
	 * @param { number } id The tag ID
	 * @returns { Promise<Tag | null> } The tag or null
	 */
	getById(id: number): Promise<Tag | null> {
		return this.repo.findById(id);
	}

	/**
	 * @description Create a new tag
	 * @param { CreateTagDto } dto Tag data
	 * @returns { Promise<Tag> } The created tag
	 */
	create(dto: CreateTagDto): Promise<Tag> {
		return this.repo.create(dto);
	}

	/**
	 * @description Update an existing tag
	 * @param { number } id The tag ID
	 * @param { UpdateTagDto } dto Update data
	 * @returns { Promise<Tag | null> } The updated tag or null
	 */
	update(id: number, dto: UpdateTagDto): Promise<Tag | null> {
		return this.repo.update(id, dto);
	}

	/**
	 * @description Delete a tag
	 * @param { number } id The tag ID
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}

	/**
	 * @description List tags for a specific article
	 * @param { string } articleId The article UUID
	 * @returns { Promise<Tag[]> } List of tags
	 */
	listByArticle(articleId: string): Promise<Tag[]> {
		return this.repo.findByArticleId(articleId);
	}

	/**
	 * @description List tags for a specific project
	 * @param { string } projectId The project UUID
	 * @returns { Promise<Tag[]> } List of tags
	 */
	listByProject(projectId: string): Promise<Tag[]> {
		return this.repo.findByProjectId(projectId);
	}
}
