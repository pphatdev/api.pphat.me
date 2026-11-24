import type { Project, IProjectRepository, CreateProjectDto, UpdateProjectDto, ProjectOrderSequenceItem } from "./projects.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ProjectService {
	constructor(private readonly repo: IProjectRepository) {}

	/**
	 * @description List all projects
	 * @param { PaginationParams } params Pagination parameters
	 * @param { boolean } [onlyPublished] Whether to only list published projects
	 * @returns { Promise<PaginatedResult<Project>> } Paginated projects
	 */
	list(
		params: PaginationParams,
		onlyPublished?: boolean,
		opts?: { admin?: boolean },
	): Promise<PaginatedResult<Project>> {
		return this.repo.findAll(params, onlyPublished, opts);
	}

	/**
	 * @description Get a project by its slug
	 * @param { string } slug The project slug
	 * @returns { Promise<Project | null> } The project or null
	 */
	getBySlug(slug: string): Promise<Project | null> {
		return this.repo.findBySlug(slug);
	}

	/**
	 * @description Create a new project
	 * @param { CreateProjectDto } dto Project data
	 * @returns { Promise<Project> } The created project
	 */
	create(dto: CreateProjectDto): Promise<Project> {
		return this.repo.create(dto);
	}

	/**
	 * @description Update an existing project
	 * @param { string } slug The project slug
	 * @param { UpdateProjectDto } dto Update data
	 * @returns { Promise<Project | null> } The updated project or null
	 */
	update(slug: string, dto: UpdateProjectDto): Promise<Project | null> {
		return this.repo.update(slug, dto);
	}

	/**
	 * @description Delete a project
	 * @param { string } slug The project slug
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(slug: string): Promise<boolean> {
		return this.repo.delete(slug);
	}

	/**
	 * @description Replace the admin-controlled display order of projects.
	 * @param { string[] } orderedIds Project ids in the desired display order
	 * @returns { Promise<number> } Rows updated
	 */
	reorder(orderedIds: string[]): Promise<number> {
		return this.repo.reorder(orderedIds);
	}

	/**
	 * @description Update project order sequence with explicit sequence numbers.
	 * @param { { id: string; sequence: number }[] } items Items with id and sequence
	 * @returns { Promise<number> } Rows updated
	 */
	updateOrderSequence(items: { id: string; sequence: number }[]): Promise<number> {
		return this.repo.updateOrderSequence(items);
	}

	/**
	 * @description Get project order sequence list
	 * @returns { Promise<ProjectOrderSequenceItem[]> } Projects in display order
	 */
	getOrderSequence(): Promise<ProjectOrderSequenceItem[]> {
		return this.repo.getOrderSequence();
	}
}
