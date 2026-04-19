import { Author, Tag, PaginatedResult, PaginationParams } from "../../../shared/interfaces";

export interface Project {
	id: string;
	title: string;
	slug: string;
	description: string;
	tags: Tag[];
	contributors: Author[];
	languages: string[];
	thumbnail: string;
	published: boolean;
	createdAt: string;
	updatedAt: string;
	details?: ProjectDetailEmbed;
}

export interface ProjectDetailEmbed {
	content: string;
	demoUrl: string;
	repoUrl: string;
	techStack: string[];
	status: 'in-progress' | 'completed' | 'archived';
}

export interface ProjectRow {
	id: string;
	title: string;
	slug: string;
	description: string;
	thumbnail: string;
	published: number;
	languages: string;
	created_at: string;
	updated_at: string;
}

export interface CreateProjectDto {
	title: string;
	slug: string;
	description: string;
	thumbnail?: string;
	published?: boolean;
	tag_ids?: number[];
	contributor_ids?: number[];
	languages?: string[];
}

export interface UpdateProjectDto {
	title?: string;
	slug?: string;
	description?: string;
	thumbnail?: string;
	published?: boolean;
	tag_ids?: number[];
	contributor_ids?: number[];
	languages?: string[];
}

export interface IProjectRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Project>>;
	findBySlug(slug: string): Promise<Project | null>;
	create(dto: CreateProjectDto): Promise<Project>;
	update(slug: string, dto: UpdateProjectDto): Promise<Project | null>;
	delete(slug: string): Promise<boolean>;
}
