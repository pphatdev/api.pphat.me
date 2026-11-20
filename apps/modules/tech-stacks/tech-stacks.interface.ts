import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export interface TechStack {
	id: number;
	name: string;
	description: string;
	url: string;
	logoUrl: string;
	/** Optional cover image URL. Null when none was uploaded. */
	cover: string | null;
	/** 0 = inactive, 1 = active. Mirrors the author_details.status pattern. */
	status: 0 | 1;
	createdAt: string;
	updatedAt: string;
}

export interface TechStackRow {
	id: number;
	name: string;
	description: string;
	url: string;
	logo_url: string;
	cover: string | null;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface CreateTechStackDto {
	name: string;
	description?: string;
	url?: string;
	logo_url?: string;
	cover?: string | null;
	status?: 0 | 1;
}

export type UpdateTechStackDto = Partial<CreateTechStackDto>;

export interface ITechStackRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<TechStack>>;
	findById(id: number): Promise<TechStack | null>;
	create(dto: CreateTechStackDto): Promise<TechStack>;
	update(id: number, dto: UpdateTechStackDto): Promise<TechStack | null>;
	delete(id: number): Promise<boolean>;
}
