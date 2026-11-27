import { ArticleStatus, PaginatedResult, PaginationParams } from "../../shared/interfaces";
import { Tag } from "../tags/tags.interface";
import { Author } from "../authors/authors.interface";


/**
 * Minimal, non-sensitive view of the user who created an article. Returned on
 * every article read so clients can render a "created by" card without a
 * second round-trip. Email / provider_id / password_hash are intentionally
 * excluded — those are not needed for attribution and would be PII leaks on
 * public endpoints.
 */
export interface ArticleOwner {
	id: string;
	name: string | null;
	avatar: string | null;
	role: 'user' | 'admin';
}

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
	/** Derived from (published, is_public, publish_at, review_requested_at). See ArticleStatus. */
	status: ArticleStatus;
	ownerId: string | null;
	/**
	 * The signed-in caller's access on GET by slug/id: `admin` and `owner` edit
	 * everything, `contributor` edits content only, `null` is read-only.
	 * Present only for Bearer sessions; absent elsewhere.
	 */
	viewerRole?: 'owner' | 'contributor' | 'admin' | null;
	owner: ArticleOwner | null;
	/** Admin-controlled display order. Lower sorts first. */
	position: number;
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
	/** Set while a non-admin's draft awaits admin review (migration 0036). */
	review_requested_at?: string | null;
	content: string;
	file_path: string;
	owner_id: string | null;
	position: number;
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

/** `owned`: articles the user created. `contributing`: articles they were added to but don't own. */
export type MineScope = 'owned' | 'contributing';

// Intentionally shares the AppEnv name with projects.interface.ts —
// each module scopes its own Variables shape (articleId + user here).
export type AppEnv = {
	Bindings: Env;
	Variables: {
		articleId: string;
		/**
		 * Set by `requireWriteAccess` alongside `articleId`. `update` uses this
		 * to enforce field-level ACL (#20): contributors may only touch
		 * content / description / thumbnail; owner + admin get the full set.
		 */
		articleRole?: 'owner' | 'contributor' | 'admin';
		user?: import('../auth/auth.interface').JwtPayload;
	};
};

export interface IArticleRepository {
	findAll(params: PaginationParams, onlyPublished?: boolean, opts?: { admin?: boolean }): Promise<PaginatedResult<Article>>;
	findAllByAuthor(
		authorId: number,
		params: PaginationParams,
		opts?: { admin?: boolean; viewerUserId?: string | null },
	): Promise<PaginatedResult<Article>>;
	findMine(userId: string, scope: MineScope, params: PaginationParams): Promise<PaginatedResult<Article>>;
	setReviewRequested(id: string, requested: boolean): Promise<void>;
	findBySlug(slug: string): Promise<Article | null>;
	findById(id: string): Promise<Article | null>;
	create(dto: CreateArticleDto): Promise<Article>;
	update(id: string, dto: UpdateArticleDto): Promise<Article | null>;
	delete(id: string): Promise<boolean>;
	isContributor(articleId: string, userId: string): Promise<boolean>;
	addContributor(articleId: string, userId: string): Promise<void>;
	removeContributor(articleId: string, userId: string): Promise<boolean>;
	ensureContributorIfNotAuthor(articleId: string, userId: string): Promise<void>;
	findTop(limit: number): Promise<Article[]>;
	getStatsSummary(): Promise<{ total: number; published: number; draft: number }>;
	promoteScheduled(): Promise<number>;
	/**
	 * Replace the admin-controlled order with the given sequence. `orderedIds`
	 * is a prefix — ids omitted keep their current position and sort after the
	 * reordered rows. Returns the number of rows updated.
	 */
	reorder(orderedIds: string[]): Promise<number>;
}

