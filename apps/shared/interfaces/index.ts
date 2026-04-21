export interface TagRow {
	tag: string;
}

export interface Tag {
	id: number;
	tag: string;
	description: string;
}

export interface Author {
	name: string;
	profile: string;
	url: string;
}

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