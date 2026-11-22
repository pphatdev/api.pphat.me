import type {
	ServiceItem,
	ServiceItemRow,
	ServiceSection,
	ServiceSectionRow,
	ServicesOverview,
	CreateServiceDto,
	UpdateServiceDto,
	UpdateServiceSectionDto,
	ServiceListParams,
	ServiceOrderSequenceItem,
	IServicesRepository,
} from "./services.interface";
import { mapServiceRow, mapServiceSectionRow } from "./services.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class ServicesRepository implements IServicesRepository {
	constructor(private readonly db: D1Database) { }

	private static readonly BASE_SERVICE_SELECT =
		`SELECT id, title, description, icon, category, features, link_url,
		        sort_order, status, created_at, updated_at
		 FROM services`;

	private static readonly BASE_SECTION_SELECT =
		`SELECT id, badge, title, description, status, created_at, updated_at
		 FROM service_sections`;

	async findAll(params: ServiceListParams): Promise<PaginatedResult<ServiceItem>> {
		const { page, limit, search, category, status, onlyActive, sort, order } = params;

		const ALLOWED_SORT_MAP: Record<string, string> = {
			id: 'id',
			title: 'title',
			category: 'category',
			sort_order: 'sort_order',
			sortOrder: 'sort_order',
			position: 'sort_order',
			sequence: 'sort_order',
			status: 'status',
			created_at: 'created_at',
			updated_at: 'updated_at',
		};

		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const chosen = sort?.[0] && ALLOWED_SORT_MAP[sort[0]];
		const orderBy = chosen ? `${chosen} ${safeOrder}` : `sort_order ASC, id ASC`;

		const conditions: string[] = [];
		const bindings: unknown[] = [];
		let idx = 1;

		if (search) {
			const like = `%${search}%`;
			conditions.push(
				`(title LIKE ?${idx} OR description LIKE ?${idx + 1} OR category LIKE ?${idx + 2} OR features LIKE ?${idx + 3})`
			);
			bindings.push(like, like, like, like);
			idx += 4;
		}

		if (category && category !== 'all') {
			conditions.push(`category = ?${idx++}`);
			bindings.push(category);
		}

		if (onlyActive) {
			conditions.push(`status = 1`);
		} else if (status !== undefined && status !== 'all') {
			const numStatus = parseInt(status, 10);
			if (!isNaN(numStatus)) {
				conditions.push(`status = ?${idx++}`);
				bindings.push(numStatus);
			}
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (limit === -1) {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${ServicesRepository.BASE_SERVICE_SELECT} ${whereClause} ORDER BY ${orderBy}`)
					.bind(...bindings)
					.all<ServiceItemRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM services ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		} else {
			const offset = (page - 1) * limit;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`${ServicesRepository.BASE_SERVICE_SELECT} ${whereClause} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
					.bind(...bindings, limit, offset)
					.all<ServiceItemRow>(),
				this.db
					.prepare(`SELECT COUNT(*) as count FROM services ${whereClause}`)
					.bind(...bindings)
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		const effectiveLimit = limit === -1 ? total : limit;
		const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0;

		return {
			data: (dataResult.results as ServiceItemRow[]).map(mapServiceRow),
			pagination: { page, limit, total, totalPages },
		};
	}

	async findById(id: number): Promise<ServiceItem | null> {
		const row = await this.db
			.prepare(`${ServicesRepository.BASE_SERVICE_SELECT} WHERE id = ?1`)
			.bind(id)
			.first<ServiceItemRow>();
		return row ? mapServiceRow(row) : null;
	}

	async create(dto: CreateServiceDto): Promise<ServiceItem> {
		const now = new Date().toISOString();
		const title = dto.title;
		const description = dto.description;
		const icon = dto.icon ?? '';
		const category = dto.category ?? 'General';
		const features = JSON.stringify(dto.features ?? []);
		const linkUrl = dto.link_url ?? '';
		const sortOrder = dto.sort_order ?? 0;
		const status = dto.status ?? 1;

		const res = await this.db
			.prepare(
				`INSERT INTO services (
					title, description, icon, category, features, link_url, sort_order, status, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
			)
			.bind(
				title,
				description,
				icon,
				category,
				features,
				linkUrl,
				sortOrder,
				status,
				now,
				now
			)
			.run();

		const id = res.meta?.last_row_id;
		if (!id) {
			throw new Error("Failed to retrieve created service id");
		}

		const created = await this.findById(id);
		if (!created) {
			throw new Error(`Failed to find created service with id ${id}`);
		}
		return created;
	}

	async update(id: number, dto: UpdateServiceDto): Promise<ServiceItem | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		const now = new Date().toISOString();
		const sets: string[] = ['updated_at = ?1'];
		const bindings: unknown[] = [now];
		let idx = 2;

		if (dto.title !== undefined) {
			sets.push(`title = ?${idx++}`);
			bindings.push(dto.title);
		}
		if (dto.description !== undefined) {
			sets.push(`description = ?${idx++}`);
			bindings.push(dto.description);
		}
		if (dto.icon !== undefined) {
			sets.push(`icon = ?${idx++}`);
			bindings.push(dto.icon);
		}
		if (dto.category !== undefined) {
			sets.push(`category = ?${idx++}`);
			bindings.push(dto.category);
		}
		if (dto.features !== undefined) {
			sets.push(`features = ?${idx++}`);
			bindings.push(JSON.stringify(dto.features));
		}
		if (dto.link_url !== undefined) {
			sets.push(`link_url = ?${idx++}`);
			bindings.push(dto.link_url);
		}
		if (dto.sort_order !== undefined) {
			sets.push(`sort_order = ?${idx++}`);
			bindings.push(dto.sort_order);
		}
		if (dto.status !== undefined) {
			sets.push(`status = ?${idx++}`);
			bindings.push(dto.status);
		}

		bindings.push(id);
		await this.db
			.prepare(`UPDATE services SET ${sets.join(', ')} WHERE id = ?${idx}`)
			.bind(...bindings)
			.run();

		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const res = await this.db
			.prepare(`DELETE FROM services WHERE id = ?1`)
			.bind(id)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}

	async getSection(): Promise<ServiceSection | null> {
		const row = await this.db
			.prepare(`${ServicesRepository.BASE_SECTION_SELECT} WHERE status = 1 ORDER BY id ASC LIMIT 1`)
			.first<ServiceSectionRow>();
		return row ? mapServiceSectionRow(row) : null;
	}

	async updateSection(dto: UpdateServiceSectionDto): Promise<ServiceSection> {
		const existing = await this.getSection();
		const now = new Date().toISOString();

		if (!existing) {
			// Create first section row if none exists
			const badge = dto.badge ?? 'Feature';
			const title = dto.title ?? 'What I can do for you';
			const description = dto.description ?? 'I can help you build your next project from scratch.';
			const status = dto.status ?? 1;

			await this.db
				.prepare(
					`INSERT INTO service_sections (badge, title, description, status, created_at, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
				)
				.bind(badge, title, description, status, now, now)
				.run();

			const created = await this.getSection();
			return created!;
		}

		const sets: string[] = ['updated_at = ?1'];
		const bindings: unknown[] = [now];
		let idx = 2;

		if (dto.badge !== undefined) {
			sets.push(`badge = ?${idx++}`);
			bindings.push(dto.badge);
		}
		if (dto.title !== undefined) {
			sets.push(`title = ?${idx++}`);
			bindings.push(dto.title);
		}
		if (dto.description !== undefined) {
			sets.push(`description = ?${idx++}`);
			bindings.push(dto.description);
		}
		if (dto.status !== undefined) {
			sets.push(`status = ?${idx++}`);
			bindings.push(dto.status);
		}

		bindings.push(existing.id);
		await this.db
			.prepare(`UPDATE service_sections SET ${sets.join(', ')} WHERE id = ?${idx}`)
			.bind(...bindings)
			.run();

		const updated = await this.getSection();
		return updated!;
	}

	async getOverview(): Promise<ServicesOverview> {
		const [section, servicesResult] = await Promise.all([
			this.getSection(),
			this.db
				.prepare(`${ServicesRepository.BASE_SERVICE_SELECT} WHERE status = 1 ORDER BY sort_order ASC, id ASC`)
				.all<ServiceItemRow>(),
		]);

		const services = (servicesResult.results as ServiceItemRow[]).map(mapServiceRow);

		return {
			section,
			services,
			total: services.length,
		};
	}

	async getOrderSequence(): Promise<ServiceOrderSequenceItem[]> {
		const res = await this.db
			.prepare(
				`SELECT id, title, icon, category, sort_order, status
				 FROM services
				 ORDER BY sort_order ASC, id ASC`
			)
			.all<{
				id: number;
				title: string;
				icon: string;
				category: string;
				sort_order: number;
				status: number;
			}>();

		return (res.results as Array<{
			id: number;
			title: string;
			icon: string;
			category: string;
			sort_order: number;
			status: number;
		}>).map((row) => ({
			id: row.id,
			title: row.title,
			icon: row.icon ?? '',
			category: row.category ?? 'General',
			sortOrder: row.sort_order ?? 0,
			position: row.sort_order ?? 0,
			sequence: row.sort_order ?? 0,
			status: (row.status === 1 ? 1 : 0) as 0 | 1,
		}));
	}

	async updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		if (items.length === 0) return 0;
		const now = new Date().toISOString();
		const statements = items.map((item) =>
			this.db
				.prepare(`UPDATE services SET sort_order = ?1, updated_at = ?2 WHERE id = ?3`)
				.bind(item.sequence, now, Number(item.id))
		);
		await this.db.batch(statements);
		return items.length;
	}

	async reorder(orderedIds: (number | string)[]): Promise<number> {
		if (orderedIds.length === 0) return 0;
		const items = orderedIds.map((id, index) => ({ id, sequence: index }));
		return this.updateOrderSequence(items);
	}
}
