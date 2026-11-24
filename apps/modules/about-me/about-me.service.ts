import type {
	IAboutMeRepository,
	CreateAboutMeDto,
	UpdateAboutMeDto,
	AboutMe,
	AboutMeListParams,
} from "./about-me.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class AboutMeService {
	constructor(private readonly repo: IAboutMeRepository) { }

	list(params: AboutMeListParams): Promise<PaginatedResult<AboutMe>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<AboutMe | null> {
		return this.repo.findById(id);
	}

	getActive(): Promise<AboutMe | null> {
		return this.repo.findActive();
	}

	create(dto: CreateAboutMeDto): Promise<AboutMe> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateAboutMeDto): Promise<AboutMe | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
