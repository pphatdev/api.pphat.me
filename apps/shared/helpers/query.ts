export interface ListOptions {
	page: number;
	limit: number;
	search?: string;
	sort?: string[];
	order?: 'asc' | 'desc';
	tags?: string[];
	authors?: string[];
}

/**
 * @description Parses common list query parameters from a URL string
 * @param { string } urlStr The full URL string
 * @returns { ListOptions } Parsed options
 */
export function parseListParams(urlStr: string): ListOptions {
	const url = new URL(urlStr);
	const sp = url.searchParams;

	const limitInput = parseInt(sp.get("limit") || '', 10);
	const limit = limitInput === -1 ? -1 : parseNumber(sp.get("limit"), 10, 1, 100);
	const page = limit === -1 ? 1 : parseNumber(sp.get("page"), 1, 1, Infinity);

	return {
		page,
		limit,
		search: sp.get("search")?.trim() || undefined,
		sort: parseArray(sp.get("sort")),
		order: parseOrder(sp.get("order")),
		tags: parseArray(sp.get("tags")),
		authors: parseArray(sp.get("authors")),
	};
}

function parseNumber(val: string | null, def: number, min: number, max: number): number {
	const n = parseInt(val || '', 10);
	const num = isNaN(n) ? def : n;
	return Math.min(max, Math.max(min, num));
}

function parseArray(val: string | null): string[] | undefined {
	if (!val) return undefined;
	const items = val.split(',').map(s => s.trim()).filter(Boolean);
	return items.length > 0 ? items : undefined;
}

function parseOrder(val: string | null): 'asc' | 'desc' | undefined {
	const o = val?.trim().toLowerCase();
	return (o === 'asc' || o === 'desc') ? o : undefined;
}
