import { PaginatedResult, PaginationParams } from "../../shared/interfaces";
import { Tag } from "../tags/tags.interface";
import { Author } from "../authors/authors.interface";


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
	tags?: { tag: string; description?: string }[];
	contributor_ids?: number[];
	languages?: string[];
	content?: string;
	demoUrl?: string;
	repoUrl?: string;
	techStack?: string[];
	status?: 'in-progress' | 'completed' | 'archived';
}

export interface UpdateProjectDto {
	title?: string;
	slug?: string;
	description?: string;
	thumbnail?: string;
	published?: boolean;
	tags?: { tag: string; description?: string }[];
	contributor_ids?: number[];
	languages?: string[];
	content?: string;
	demoUrl?: string;
	repoUrl?: string;
	techStack?: string[];
	status?: 'in-progress' | 'completed' | 'archived';
}

export interface AppEnv {
	Bindings: Env;
	Variables: { projectId: string };
}

export interface IProjectRepository {
	findAll(params: PaginationParams, onlyPublished?: boolean): Promise<PaginatedResult<Project>>;
	findBySlug(slug: string): Promise<Project | null>;
	create(dto: CreateProjectDto): Promise<Project>;
	update(slug: string, dto: UpdateProjectDto): Promise<Project | null>;
	delete(slug: string): Promise<boolean>;
}
