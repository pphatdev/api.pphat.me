import type { ISkillRepository, CreateSkillDto, UpdateSkillDto, Skill } from "./skills.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class SkillService {
	constructor(private readonly repo: ISkillRepository) { }

	list(params: PaginationParams): Promise<PaginatedResult<Skill>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<Skill | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateSkillDto): Promise<Skill> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateSkillDto): Promise<Skill | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
