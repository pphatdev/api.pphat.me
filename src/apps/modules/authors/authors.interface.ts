export interface Author {
	id: number;
	name: string;
	profile: string;
	url: string;
	bio: string;
	avatarUrl: string;
	socialLinks: string[];
	status: number;
	createdAt: string;
	updatedAt: string;
}

export interface AuthorRow {
	id: number;
	name: string;
	profile: string;
	url: string;
}

export interface AuthorDetailRow {
	bio: string;
	avatar_url: string;
	social_links: string;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface CreateAuthorDto {
	name: string;
	profile?: string;
	url?: string;
	bio?: string;
	avatar_url?: string;
	social_links?: string[];
	status?: number;
}

export interface UpdateAuthorDto {
	name?: string;
	profile?: string;
	url?: string;
	bio?: string;
	avatar_url?: string;
	social_links?: string[];
	status?: number;
}

export interface IAuthorRepository {
	findAll(): Promise<Author[]>;
	findById(id: number): Promise<Author | null>;
	create(dto: CreateAuthorDto): Promise<Author>;
	update(id: number, dto: UpdateAuthorDto): Promise<Author | null>;
	delete(id: number): Promise<boolean>;
}
