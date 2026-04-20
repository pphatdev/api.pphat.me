import type { ProjectDetail, IProjectDetailRepository, CreateProjectDetailDto, UpdateProjectDetailDto } from "./project-details.interface";

export class ProjectDetailService {
	constructor(private readonly repo: IProjectDetailRepository) {}

	get(projectId: string): Promise<ProjectDetail | null> {
		return this.repo.findByProjectId(projectId);
	}

	upsert(projectId: string, dto: CreateProjectDetailDto | UpdateProjectDetailDto): Promise<ProjectDetail> {
		return this.repo.upsert(projectId, dto);
	}

	delete(projectId: string): Promise<boolean> {
		return this.repo.delete(projectId);
	}
}
