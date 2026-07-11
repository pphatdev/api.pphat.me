import type { ProjectDetail, IProjectDetailRepository, CreateProjectDetailDto, UpdateProjectDetailDto } from "./project-details.interface";

export class ProjectDetailService {
	constructor(private readonly repo: IProjectDetailRepository) {}

	/**
	 * @description Get details for a specific project
	 * @param { string } projectId The project UUID
	 * @returns { Promise<ProjectDetail | null> } The details or null
	 */
	get(projectId: string): Promise<ProjectDetail | null> {
		return this.repo.findByProjectId(projectId);
	}

	/**
	 * @description Create or update project details
	 * @param { string } projectId The project UUID
	 * @param { CreateProjectDetailDto | UpdateProjectDetailDto } dto The data to upsert
	 * @returns { Promise<ProjectDetail> } The upserted details
	 */
	upsert(projectId: string, dto: CreateProjectDetailDto | UpdateProjectDetailDto): Promise<ProjectDetail> {
		return this.repo.upsert(projectId, dto);
	}

	/**
	 * @description Delete details for a specific project
	 * @param { string } projectId The project UUID
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(projectId: string): Promise<boolean> {
		return this.repo.delete(projectId);
	}
}
