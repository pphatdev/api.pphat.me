import { PaginatedResult } from "../../shared/interfaces";

export interface ServiceItem {
	id: number;
	title: string;
	description: string;
	/** Alias for description */
	content: string;
	icon: string;
	/** Alias for icon */
	iconName: string;
	category: string;
	features: string[];
	linkUrl: string;
	link_url: string;
	sortOrder: number;
	sort_order: number;
	position: number;
	sequence: number;
	status: 0 | 1;
	createdAt: string;
	created_at: string;
	updatedAt: string;
	updated_at: string;
}

export interface ServiceItemRow {
	id: number;
	title: string;
	description: string;
	icon: string;
	category: string;
	features: string;
	link_url: string;
	sort_order: number;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface ServiceSection {
	id: number;
	badge: string;
	title: string;
	description: string;
	status: 0 | 1;
	createdAt: string;
	created_at: string;
	updatedAt: string;
	updated_at: string;
}

export interface ServiceSectionRow {
	id: number;
	badge: string;
	title: string;
	description: string;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface ServicesOverview {
	section: ServiceSection | null;
	services: ServiceItem[];
	total: number;
}

export interface CreateServiceDto {
	title: string;
	description: string;
	icon?: string;
	category?: string;
	features?: string[];
	link_url?: string;
	sort_order?: number;
	status?: 0 | 1;
}

export type UpdateServiceDto = Partial<CreateServiceDto>;

export interface UpdateServiceSectionDto {
	badge?: string;
	title?: string;
	description?: string;
	status?: 0 | 1;
}

export interface ServiceListParams {
	page: number;
	limit: number;
	search?: string;
	category?: string;
	status?: string;
	onlyActive?: boolean;
	sort?: string[];
	order?: 'asc' | 'desc';
}

export interface ServiceOrderSequenceItem {
	id: number;
	title: string;
	icon: string;
	category: string;
	sortOrder: number;
	position: number;
	sequence: number;
	status: 0 | 1;
}

export interface IServicesRepository {
	findAll(params: ServiceListParams): Promise<PaginatedResult<ServiceItem>>;
	findById(id: number): Promise<ServiceItem | null>;
	create(dto: CreateServiceDto): Promise<ServiceItem>;
	update(id: number, dto: UpdateServiceDto): Promise<ServiceItem | null>;
	delete(id: number): Promise<boolean>;
	getSection(): Promise<ServiceSection | null>;
	updateSection(dto: UpdateServiceSectionDto): Promise<ServiceSection>;
	getOverview(): Promise<ServicesOverview>;
	getOrderSequence(): Promise<ServiceOrderSequenceItem[]>;
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

export function mapServiceRow(row: ServiceItemRow): ServiceItem {
	let parsedFeatures: string[] = [];
	try {
		if (typeof row.features === 'string') {
			const parsed = JSON.parse(row.features);
			if (Array.isArray(parsed)) {
				parsedFeatures = parsed.map(String);
			}
		} else if (Array.isArray(row.features)) {
			parsedFeatures = (row.features as unknown[]).map(String);
		}
	} catch {
		parsedFeatures = [];
	}

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		content: row.description,
		icon: row.icon ?? '',
		iconName: row.icon ?? '',
		category: row.category ?? 'General',
		features: parsedFeatures,
		linkUrl: row.link_url ?? '',
		link_url: row.link_url ?? '',
		sortOrder: row.sort_order ?? 0,
		sort_order: row.sort_order ?? 0,
		position: row.sort_order ?? 0,
		sequence: row.sort_order ?? 0,
		status: (row.status === 1 ? 1 : 0) as 0 | 1,
		createdAt: row.created_at,
		created_at: row.created_at,
		updatedAt: row.updated_at,
		updated_at: row.updated_at,
	};
}

export function mapServiceSectionRow(row: ServiceSectionRow): ServiceSection {
	return {
		id: row.id,
		badge: row.badge ?? 'Feature',
		title: row.title ?? 'What I can do for you',
		description: row.description ?? '',
		status: (row.status === 1 ? 1 : 0) as 0 | 1,
		createdAt: row.created_at,
		created_at: row.created_at,
		updatedAt: row.updated_at,
		updated_at: row.updated_at,
	};
}
