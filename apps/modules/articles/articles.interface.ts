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
	ownerId: string | null;
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
	owner_id: string | null;
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
	owner_id?: string;
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

export type AppEnv = {
	Bindings: Env;
	Variables: {
		articleId: string;
		user?: import('../auth/auth.interface').JwtPayload;
	};
};

export interface IArticleRepository {
	findAll(params: PaginationParams, onlyPublished?: boolean): Promise<PaginatedResult<Article>>;
	findAllByAuthor(authorId: number, params: PaginationParams, onlyPublished: boolean): Promise<PaginatedResult<Article>>;
	findBySlug(slug: string): Promise<Article | null>;
	findById(id: string): Promise<Article | null>;
	create(dto: CreateArticleDto): Promise<Article>;
	update(id: string, dto: UpdateArticleDto): Promise<Article | null>;
	delete(id: string): Promise<boolean>;
	isOwner(articleId: string, userId: string): Promise<boolean>;
	isContributor(articleId: string, userId: string): Promise<boolean>;
	addContributor(articleId: string, userId: string): Promise<void>;
	removeContributor(articleId: string, userId: string): Promise<boolean>;
}

