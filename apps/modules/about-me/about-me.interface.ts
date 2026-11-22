import { PaginatedResult } from "../../shared/interfaces";

export interface AboutMe {
	id: number;
	badge: string;
	title: string;
	description: string;
	/** Alias for description */
	content: string;
	/** Alias for description */
	bio: string;
	buttonText: string;
	button_text: string;
	buttonUrl: string;
	button_url: string;
	images: string[];
	name: string;
	nickname: string;
	role: string;
	location: string;
	sortOrder: number;
	sort_order: number;
	status: 0 | 1;
	createdAt: string;
	created_at: string;
	updatedAt: string;
	updated_at: string;
}

export interface AboutMeRow {
	id: number;
	badge: string;
	title: string;
	description: string;
	button_text: string;
	button_url: string;
	images: string;
	name: string;
	nickname: string;
	role: string;
	location: string;
	sort_order: number;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface CreateAboutMeDto {
	badge?: string;
	title: string;
	description: string;
	button_text?: string;
	button_url?: string;
	images?: string[];
	name?: string;
	nickname?: string;
	role?: string;
	location?: string;
	sort_order?: number;
	status?: 0 | 1;
}

export type UpdateAboutMeDto = Partial<CreateAboutMeDto>;

export interface AboutMeListParams {
	page: number;
	limit: number;
	search?: string;
	status?: string;
	onlyActive?: boolean;
	sort?: string[];
	order?: 'asc' | 'desc';
}

export interface IAboutMeRepository {
	findAll(params: AboutMeListParams): Promise<PaginatedResult<AboutMe>>;
	findById(id: number): Promise<AboutMe | null>;
	findActive(): Promise<AboutMe | null>;
	create(dto: CreateAboutMeDto): Promise<AboutMe>;
	update(id: number, dto: UpdateAboutMeDto): Promise<AboutMe | null>;
	delete(id: number): Promise<boolean>;
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

export function mapAboutMeRow(row: AboutMeRow): AboutMe {
	let parsedImages: string[] = [];
	try {
		if (typeof row.images === 'string') {
			const parsed = JSON.parse(row.images);
			if (Array.isArray(parsed)) {
				parsedImages = parsed.map(String);
			}
		} else if (Array.isArray(row.images)) {
			parsedImages = (row.images as unknown[]).map(String);
		}
	} catch {
		parsedImages = [];
	}

	return {
		id: row.id,
		badge: row.badge ?? 'About me!',
		title: row.title,
		description: row.description,
		content: row.description,
		bio: row.description,
		buttonText: row.button_text ?? 'Gallery',
		button_text: row.button_text ?? 'Gallery',
		buttonUrl: row.button_url ?? '',
		button_url: row.button_url ?? '',
		images: parsedImages,
		name: row.name ?? '',
		nickname: row.nickname ?? '',
		role: row.role ?? '',
		location: row.location ?? '',
		sortOrder: row.sort_order ?? 0,
		sort_order: row.sort_order ?? 0,
		status: (row.status === 1 ? 1 : 0) as 0 | 1,
		createdAt: row.created_at,
		created_at: row.created_at,
		updatedAt: row.updated_at,
		updated_at: row.updated_at,
	};
}
