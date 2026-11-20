import type { IExperienceRepository, CreateExperienceDto, UpdateExperienceDto, Experience, TimelineCompany } from "./experiences.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class ExperienceService {
	constructor(private readonly repo: IExperienceRepository) { }

	list(params: PaginationParams): Promise<PaginatedResult<Experience>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<Experience | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateExperienceDto): Promise<Experience> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateExperienceDto): Promise<Experience | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}

	getTimeline(params: PaginationParams): Promise<PaginatedResult<TimelineCompany>> {
		return this.repo.getTimeline(params);
	}

	setSkills(experienceId: number, techStackIds: number[]): Promise<void> {
		return this.repo.setSkills(experienceId, techStackIds);
	}

	attachSkill(experienceId: number, techStackId: number): Promise<boolean> {
		return this.repo.attachSkill(experienceId, techStackId);
	}

	detachSkill(experienceId: number, techStackId: number): Promise<boolean> {
		return this.repo.detachSkill(experienceId, techStackId);
	}
}
