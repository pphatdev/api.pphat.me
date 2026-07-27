
export type ArticleStatus = 'public' | 'draft' | 'queue' | 'private';

export interface PaginationParams {
	page: number;
	limit: number;
	search?: string;
	sort?: string[];
	order?: 'asc' | 'desc';
	tags?: string[];
	authors?: string[];
	/** Filter articles by derived status. Ignored for non-admins. */
	status?: ArticleStatus[];
}

export interface PaginatedResult<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}