import { PaginatedResult } from "../../shared/interfaces";

export type GalleryAspectRatio = '16/9' | '4/3' | '1/1' | '3/4' | '9/16' | 'auto';

export const GALLERY_ASPECT_RATIOS: readonly GalleryAspectRatio[] = [
	'16/9',
	'4/3',
	'1/1',
	'3/4',
	'9/16',
	'auto',
];

export interface GalleryItem {
	id: number;
	title: string;
	caption: string;
	altText: string;
	alt_text: string;
	mediaPath: string;
	media_path: string;
	category: string;
	tags: string[];
	isPublic: boolean;
	is_public: number;
	isFeatured: boolean;
	is_featured: number;
	sortOrder: number;
	sort_order: number;
	position: number;
	sequence: number;
	aspectRatio: GalleryAspectRatio;
	aspect_ratio: GalleryAspectRatio;
	createdAt: string;
	created_at: string;
	updatedAt: string;
	updated_at: string;
}

export interface GalleryItemRow {
	id: number;
	title: string;
	caption: string;
	alt_text: string;
	media_path: string;
	category: string;
	tags: string;
	is_public: number;
	is_featured: number;
	sort_order: number;
	aspect_ratio: string;
	created_at: string;
	updated_at: string;
}

export interface CreateGalleryItemDto {
	title: string;
	caption?: string;
	alt_text?: string;
	media_path: string;
	category?: string;
	tags?: string[];
	is_public?: number | boolean;
	is_featured?: number | boolean;
	sort_order?: number;
	aspect_ratio?: GalleryAspectRatio;
}

export type UpdateGalleryItemDto = Partial<CreateGalleryItemDto>;

export interface GalleryListParams {
	page: number;
	limit: number;
	search?: string;
	category?: string;
	visibility?: 'all' | 'public' | 'hidden' | 'featured';
	is_public?: number | boolean;
	is_featured?: number | boolean;
	onlyPublic?: boolean;
	sort?: string[];
	order?: 'asc' | 'desc';
}

export interface GalleryStats {
	total: number;
	publicCount: number;
	hiddenCount: number;
	featuredCount: number;
	categoriesCount: number;
	categories: string[];
}

export interface GalleryOrderSequenceItem {
	id: number;
	title: string;
	category: string;
	mediaPath: string;
	sortOrder: number;
	position: number;
	sequence: number;
	isPublic: boolean;
	isFeatured: boolean;
}

export interface IGalleryRepository {
	findAll(params: GalleryListParams): Promise<PaginatedResult<GalleryItem>>;
	findById(id: number): Promise<GalleryItem | null>;
	findFeatured(): Promise<GalleryItem[]>;
	getStats(): Promise<GalleryStats>;
	create(dto: CreateGalleryItemDto): Promise<GalleryItem>;
	update(id: number, dto: UpdateGalleryItemDto): Promise<GalleryItem | null>;
	delete(id: number): Promise<boolean>;
	getOrderSequence(): Promise<GalleryOrderSequenceItem[]>;
	updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number>;
	reorder(orderedIds: (number | string)[]): Promise<number>;
}

export type AppEnv = {
	Bindings: Env;
	Variables: {
		user?: {
			userId: string;
			email: string;
			role: 'admin' | 'user';
		};
	};
};

export function mapGalleryItemRow(row: GalleryItemRow): GalleryItem {
	let parsedTags: string[] = [];
	try {
		if (typeof row.tags === 'string') {
			const parsed = JSON.parse(row.tags);
			if (Array.isArray(parsed)) {
				parsedTags = parsed.map(String);
			}
		} else if (Array.isArray(row.tags)) {
			parsedTags = (row.tags as unknown[]).map(String);
		}
	} catch {
		parsedTags = [];
	}

	const ratio = (GALLERY_ASPECT_RATIOS.includes(row.aspect_ratio as GalleryAspectRatio)
		? row.aspect_ratio
		: '16/9') as GalleryAspectRatio;

	const isPublic = row.is_public === 1;
	const isFeatured = row.is_featured === 1;

	return {
		id: row.id,
		title: row.title,
		caption: row.caption ?? '',
		altText: row.alt_text ?? '',
		alt_text: row.alt_text ?? '',
		mediaPath: row.media_path,
		media_path: row.media_path,
		category: row.category ?? 'photography',
		tags: parsedTags,
		isPublic,
		is_public: row.is_public,
		isFeatured,
		is_featured: row.is_featured,
		sortOrder: row.sort_order ?? 0,
		sort_order: row.sort_order ?? 0,
		position: row.sort_order ?? 0,
		sequence: row.sort_order ?? 0,
		aspectRatio: ratio,
		aspect_ratio: ratio,
		createdAt: row.created_at,
		created_at: row.created_at,
		updatedAt: row.updated_at,
		updated_at: row.updated_at,
	};
}
