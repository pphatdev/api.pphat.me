import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

/**
 * Referenced article details embedded into an FAQ response.
 */
export interface FaqArticleRef {
	id: string;
	title: string;
	slug: string;
	description: string;
}

/**
 * Public FAQ entity shape.
 * `answer` and `content` are identical aliases to support full article-style
 * markdown content in the answer.
 */
export interface Faq {
	id: number;
	question: string;
	slug: string;
	answer: string;
	/** Alias for answer so clients can consume FAQ answers as rich article content */
	content: string;
	category: string;
	sortOrder: number;
	/** Alias for sortOrder */
	position?: number;
	/** Alias for sortOrder */
	sequence?: number;
	status: 0 | 1;
	articleId: string | null;
	article: FaqArticleRef | null;
	readingMins: number;
	wordCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface FaqOrderSequenceItem {
	id: number;
	question: string;
	slug: string;
	category: string;
	sortOrder: number;
	position: number;
	sequence: number;
	status: 0 | 1;
}

export interface FaqRow {
	id: number;
	question: string;
	slug: string;
	answer: string;
	category: string;
	sort_order: number;
	status: number;
	article_id: string | null;
	created_at: string;
	updated_at: string;
	article_title?: string | null;
	article_slug?: string | null;
	article_description?: string | null;
}

export interface CreateFaqDto {
	question: string;
	answer?: string;
	/** Alias for answer */
	content?: string;
	slug?: string;
	category?: string;
	sort_order?: number;
	sortOrder?: number;
	status?: 0 | 1;
	article_id?: string | null;
	articleId?: string | null;
}

export type UpdateFaqDto = Partial<CreateFaqDto>;

export interface FaqListParams extends Omit<PaginationParams, 'status'> {
	category?: string;
	status?: string;
	onlyActive?: boolean;
}

export type AppEnv = {
	Bindings: Env;
	Variables: {
		user?: import('../auth/auth.interface').JwtPayload;
	};
};

export interface IFaqRepository {
	findAll(params: FaqListParams): Promise<PaginatedResult<Faq>>;
	findById(id: number): Promise<Faq | null>;
	findBySlug(slug: string): Promise<Faq | null>;
	findByIdOrSlug(idOrSlug: string): Promise<Faq | null>;
	create(dto: CreateFaqDto): Promise<Faq>;
	update(id: number, dto: UpdateFaqDto): Promise<Faq | null>;
	delete(id: number): Promise<boolean>;
	reorder(orderedIds: (number | string)[]): Promise<number>;
	updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number>;
	getOrderSequence(): Promise<FaqOrderSequenceItem[]>;
}

/**
 * @description Compute estimated reading time and word count for FAQ content
 * @param { string } content The answer / article content
 * @returns { { readingMins: number; wordCount: number } }
 */
export function computeFaqStats(content: string): { readingMins: number; wordCount: number } {
	const words = (content || '').trim().split(/\s+/).filter(Boolean);
	const wordCount = words.length;
	const readingMins = Math.max(1, Math.ceil(wordCount / 200));
	return { readingMins, wordCount };
}

/**
 * @description Convert a string into a URL-friendly slug
 * @param { string } text Input text
 * @returns { string } Normalized slug
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
