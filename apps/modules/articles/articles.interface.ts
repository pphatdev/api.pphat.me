import { PaginatedResult, PaginationParams } from "../../shared/interfaces";
import { Tag } from "../tags/tags.interface";
import { Author } from "../authors/authors.interface";


export interface Article {
	id: string;
	title: string;
	slug: string;
	description: string;
	tags: Tag[];
	authors: Author[];
	thumbnail: string;
	published: boolean;
	isPublic: boolean;
	/** Scheduled publication time, formatted as Asia/Phnom_Penh (+07:00) — null when not scheduled */
	publishAt: string | null;
	ownerId: string | null;
	createdAt: string;
	updatedAt: string;
	content?: string;
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
	is_public: number;
	publish_at: string | null;
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
	/** Explicit public-visibility flag. Defaults to false unless publish_at has already passed. */
	is_public?: boolean;
	/** Asia/Phnom_Penh timestamp (ISO with +07:00 offset or `YYYY-MM-DD HH:mm` local) — when reached, the cron promotes is_public=1 */
	publish_at?: string | null;
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
	is_public?: boolean;
	publish_at?: string | null;
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
	findTop(limit: number): Promise<Article[]>;
	getStatsSummary(): Promise<{ total: number; published: number; draft: number }>;
	promoteScheduled(): Promise<number>;
}

