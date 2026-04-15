export interface Tag {
	id: number;
	tag: string;
	description: string;
}

export interface TagRow {
	id: number;
	tag: string;
	description: string;
}

export interface CreateTagDto {
	tag: string;
	description?: string;
}

export interface UpdateTagDto {
	tag?: string;
	description?: string;
}

export interface ITagRepository {
	findAll(): Promise<Tag[]>;
	findById(id: number): Promise<Tag | null>;
	create(dto: CreateTagDto): Promise<Tag>;
	update(id: number, dto: UpdateTagDto): Promise<Tag | null>;
	delete(id: number): Promise<boolean>;
}
