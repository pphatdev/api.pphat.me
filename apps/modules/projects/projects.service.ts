import type { Project, IProjectRepository, CreateProjectDto, UpdateProjectDto } from "./projects.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ProjectService {
	constructor(private readonly repo: IProjectRepository) {}

	list(params: PaginationParams): Promise<PaginatedResult<Project>> {
		return this.repo.findAll(params);
	}

	getBySlug(slug: string): Promise<Project | null> {
		return this.repo.findBySlug(slug);
	}

	create(dto: CreateProjectDto): Promise<Project> {
		return this.repo.create(dto);
	}

	update(slug: string, dto: UpdateProjectDto): Promise<Project | null> {
		return this.repo.update(slug, dto);
	}

	delete(slug: string): Promise<boolean> {
		return this.repo.delete(slug);
	}
}
