import { Tag, Author, PaginatedResult, PaginationParams } from "../../shared/interfaces";

export interface Article {
	id: string;
	title: string;
	slug: string;
	description: string;
	tags: Tag[];
	authors: Author[];
	thumbnail: string;
	published: boolean;
	createdAt: string;
	updatedAt: string;
	content: string;
	filePath: string;
	stats?: { views: number; readingMins: number };
	reactions?: { type: string; count: number }[];
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
	tags?: { tag: string; description?: string }[];
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
	tags?: { tag: string; description?: string }[];
}

export type AppEnv = { Bindings: Env; Variables: { articleId: string } };

export interface IArticleRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Article>>;
	findBySlug(slug: string): Promise<Article | null>;
	create(dto: CreateArticleDto): Promise<Article>;
	update(slug: string, dto: UpdateArticleDto): Promise<Article | null>;
	delete(slug: string): Promise<boolean>;
}
