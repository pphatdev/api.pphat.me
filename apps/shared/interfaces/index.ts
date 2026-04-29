
export interface PaginationParams {
	page: number;
	limit: number;
	search?: string;
	sort?: string[];
	order?: 'asc' | 'desc';
	tags?: string[];
	authors?: string[];
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