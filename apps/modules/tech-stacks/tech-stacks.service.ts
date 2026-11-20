import type { ITechStackRepository, CreateTechStackDto, UpdateTechStackDto, TechStack } from "./tech-stacks.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class TechStackService {
	constructor(private readonly repo: ITechStackRepository) { }

	list(params: PaginationParams): Promise<PaginatedResult<TechStack>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<TechStack | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateTechStackDto): Promise<TechStack> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateTechStackDto): Promise<TechStack | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
