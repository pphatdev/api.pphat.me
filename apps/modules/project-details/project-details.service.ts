import type { ProjectDetail, IProjectDetailRepository, CreateProjectDetailDto, UpdateProjectDetailDto } from "./project-details.interface";

export class GetProjectDetail {
	constructor(private readonly repo: IProjectDetailRepository) {}
	execute(projectId: string): Promise<ProjectDetail | null> {
		return this.repo.findByProjectId(projectId);
	}
}

export class UpsertProjectDetail {
	constructor(private readonly repo: IProjectDetailRepository) {}
	execute(projectId: string, dto: CreateProjectDetailDto | UpdateProjectDetailDto): Promise<ProjectDetail> {
		return this.repo.upsert(projectId, dto);
	}
}

export class DeleteProjectDetail {
	constructor(private readonly repo: IProjectDetailRepository) {}
	execute(projectId: string): Promise<boolean> {
		return this.repo.delete(projectId);
	}
}
