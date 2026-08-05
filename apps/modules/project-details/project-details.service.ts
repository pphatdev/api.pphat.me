import type { ProjectDetail, IProjectDetailRepository } from "./project-details.interface";

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
}
