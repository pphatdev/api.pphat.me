import type { Project, IProjectRepository, CreateProjectDto, UpdateProjectDto } from "./projects.interface";
import { PaginatedResult, PaginationParams } from "../../../shared/interfaces";

export class ListProjects {
	constructor(private readonly repo: IProjectRepository) {}
	execute(params: PaginationParams): Promise<PaginatedResult<Project>> {
		return this.repo.findAll(params);
	}
}

export class GetProjectBySlug {
	constructor(private readonly repo: IProjectRepository) {}
	execute(slug: string): Promise<Project | null> {
		return this.repo.findBySlug(slug);
	}
}

export class CreateProject {
	constructor(private readonly repo: IProjectRepository) {}
	execute(dto: CreateProjectDto): Promise<Project> {
		return this.repo.create(dto);
	}
}

export class UpdateProject {
	constructor(private readonly repo: IProjectRepository) {}
	execute(slug: string, dto: UpdateProjectDto): Promise<Project | null> {
		return this.repo.update(slug, dto);
	}
}

export class DeleteProject {
	constructor(private readonly repo: IProjectRepository) {}
	execute(slug: string): Promise<boolean> {
		return this.repo.delete(slug);
	}
}
