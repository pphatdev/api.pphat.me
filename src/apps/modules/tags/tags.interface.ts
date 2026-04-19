import { PaginatedResult, PaginationParams } from "../../../shared/interfaces";

export interface Tag {
	id: number;
	tag: string;
	description: string;
	article_id?: string | null;
	project_id?: string | null;
}

export interface TagRow {
	id: number;
	tag: string;
	description: string;
	article_id: string | null;
	project_id: string | null;
}

export interface CreateTagDto {
	tag: string;
	description?: string;
	article_id?: string | null;
	project_id?: string | null;
}

export interface UpdateTagDto {
	tag?: string;
	description?: string;
	article_id?: string | null;
	project_id?: string | null;
}

export interface ITagRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Tag>>;
	findById(id: number): Promise<Tag | null>;
	create(dto: CreateTagDto): Promise<Tag>;
	update(id: number, dto: UpdateTagDto): Promise<Tag | null>;
	delete(id: number): Promise<boolean>;
}
