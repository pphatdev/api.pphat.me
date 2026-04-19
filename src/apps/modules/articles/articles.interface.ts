import { Author, PaginatedResult, PaginationParams } from "../../../shared/interfaces";

export interface Article {
	id: string;
	title: string;
	slug: string;
	description: string;
	tags: string[];
	authors: Author[];
	thumbnail: string;
	published: boolean;
	createdAt: string;
	updatedAt: string;
	content: string;
	filePath: string;
}

export interface ArticleRow {
	id: string;
	title: string;
	slug: string;
	description: string;
	thumbnail: string;
	published: number;
	content: string;
	file_path: string;
	created_at: string;
	updated_at: string;
}


export interface CreateArticleDto {
	title: string;
	slug: string;
	description: string;
	thumbnail?: string;
	content?: string;
	file_path?: string;
	published?: boolean;
	author_ids?: number[];
	tag_ids?: number[];
}

export interface UpdateArticleDto {
	title?: string;
	slug?: string;
	description?: string;
	thumbnail?: string;
	content?: string;
	file_path?: string;
	published?: boolean;
	author_ids?: number[];
	tag_ids?: number[];
}

export interface IArticleRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Article>>;
	findBySlug(slug: string): Promise<Article | null>;
	create(dto: CreateArticleDto): Promise<Article>;
	update(slug: string, dto: UpdateArticleDto): Promise<Article | null>;
	delete(slug: string): Promise<boolean>;
}
