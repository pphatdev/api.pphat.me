import type { Experience, ExperienceRow, CreateExperienceDto, IExperienceRepository, UpdateExperienceDto, EmploymentType, TimelineCompany, TimelinePeriod, TimelineRole, TimelineSkill } from "./experiences.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @description Format a stored date as "YYYY, Mmm" (e.g. "2020, Nov").
 * Accepts YYYY-MM-DD, YYYY-MM, or a full ISO. Returns the raw input on any
 * parse failure so the response degrades gracefully rather than throwing.
 */
function formatMonthYear(iso: string): string {
	const normalized = iso.length === 7 ? `${iso}-01` : iso;
	const parsed = new Date(normalized.includes('T') ? normalized : `${normalized}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return iso;
	return `${parsed.getUTCFullYear()}, ${MONTHS[parsed.getUTCMonth()]}`;
}

/**
 * @description Build the structured period object. When end_date is NULL the
 * role is marked current and `to` holds today's "YYYY, Mmm" so a client can
 * render a live range without doing the "now" lookup itself.
 */
function buildPeriod(startDate: string, endDate: string | null, now: Date = new Date()): TimelinePeriod {
	const isCurrent = endDate === null;
	return {
		from: formatMonthYear(startDate),
		isCurrent,
		to: isCurrent
			? `${now.getUTCFullYear()}, ${MONTHS[now.getUTCMonth()]}`
			: formatMonthYear(endDate as string),
	};
}

export class ExperienceRepository implements IExperienceRepository {
	constructor(private readonly db: D1Database) { }

	/**
	 * @description List experiences with timeline ordering: current roles
	 * (end_date IS NULL) float to the top, then order by start_date descending
	 * so the most recent role shows first. Callers can override by passing
	 * `?sort=<column>` — the explicit sort replaces the default timeline order.
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<Experience>> } Paginated experiences
	 */
	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Experience>> {
		const ALLOWED_SORT = ['id', 'title', 'company', 'start_date', 'end_date', 'status', 'created_at', 'updated_at'];
		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		// Timeline default: NULL end_date (ongoing) sorts first via coalesce to
		// a far-future date, then by start_date DESC so the most recent start
		// is at the top of each bucket.
		const orderBy = sort?.[0] && ALLOWED_SORT.includes(sort[0])
			? `${sort[0]} ${safeOrder}`
			: `COALESCE(end_date, '9999-12-31') DESC, start_date DESC`;
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM experiences WHERE (title LIKE ?1 OR company LIKE ?2 OR description LIKE ?3) ORDER BY ${orderBy} LIMIT ?4 OFFSET ?5`)
					.bind(like, like, like, limit, offset)
					.all<ExperienceRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM experiences WHERE (title LIKE ?1 OR company LIKE ?2 OR description LIKE ?3)")
					.bind(like, like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM experiences ORDER BY ${orderBy} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<ExperienceRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM experiences")
					.first<{ count: number }>(),
			]);
		}

		const total = countRow?.count ?? 0;
		return {
			data: (dataResult.results as ExperienceRow[]).map(this.mapRow),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/**
	 * @description Find an experience by id.
	 * @param { number } id Experience id
	 * @returns { Promise<Experience | null> } Experience or null
	 */
	async findById(id: number): Promise<Experience | null> {
		const row = await this.db
			.prepare("SELECT * FROM experiences WHERE id = ?1")
			.bind(id)
			.first<ExperienceRow>();
		return row ? this.mapRow(row) : null;
	}

	/**
	 * @description Create an experience.
	 * @param { CreateExperienceDto } dto Experience data
	 * @returns { Promise<Experience> } Created experience
	 */
	async create(dto: CreateExperienceDto): Promise<Experience> {
		const now = new Date().toISOString();
		const status = dto.status === 0 ? 0 : 1;
		const employmentType: EmploymentType = dto.employment_type ?? 'full-time';

		const result = await this.db
			.prepare(
				"INSERT INTO experiences (title, company, description, start_date, end_date, location, employment_type, company_url, logo_url, cover, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
			)
			.bind(
				dto.title,
				dto.company,
				dto.description ?? '',
				dto.start_date,
				dto.end_date ?? null,
				dto.location ?? '',
				employmentType,
				dto.company_url ?? '',
				dto.logo_url ?? '',
				dto.cover ?? null,
				status,
				now,
				now,
			)
			.run();

		const id = result.meta.last_row_id as number;
		const row = await this.db
			.prepare("SELECT * FROM experiences WHERE id = ?1")
			.bind(id)
			.first<ExperienceRow>();
		return this.mapRow(row!);
	}

	/**
	 * @description Update an experience. Partial — only provided fields change.
	 * @param { number } id Experience id
	 * @param { UpdateExperienceDto } dto Fields to update
	 * @returns { Promise<Experience | null> } Updated experience or null
	 */
	async update(id: number, dto: UpdateExperienceDto): Promise<Experience | null> {
		const existing = await this.db
			.prepare("SELECT * FROM experiences WHERE id = ?1")
			.bind(id)
			.first<ExperienceRow>();
		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.title !== undefined) { fields.push(`title = ?${idx++}`); values.push(dto.title); }
		if (dto.company !== undefined) { fields.push(`company = ?${idx++}`); values.push(dto.company); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.start_date !== undefined) { fields.push(`start_date = ?${idx++}`); values.push(dto.start_date); }
		// end_date accepts explicit null to clear the end date (make the role current again).
		if (dto.end_date !== undefined) { fields.push(`end_date = ?${idx++}`); values.push(dto.end_date); }
		if (dto.location !== undefined) { fields.push(`location = ?${idx++}`); values.push(dto.location); }
		if (dto.employment_type !== undefined) { fields.push(`employment_type = ?${idx++}`); values.push(dto.employment_type); }
		if (dto.company_url !== undefined) { fields.push(`company_url = ?${idx++}`); values.push(dto.company_url); }
		if (dto.logo_url !== undefined) { fields.push(`logo_url = ?${idx++}`); values.push(dto.logo_url); }
		if (dto.cover !== undefined) { fields.push(`cover = ?${idx++}`); values.push(dto.cover); }
		if (dto.status !== undefined) { fields.push(`status = ?${idx++}`); values.push(dto.status === 0 ? 0 : 1); }

		if (fields.length === 0) return this.mapRow(existing);

		fields.push(`updated_at = ?${idx}`);
		values.push(new Date().toISOString());
		values.push(id);

		await this.db
			.prepare(`UPDATE experiences SET ${fields.join(", ")} WHERE id = ?${idx + 1}`)
			.bind(...values)
			.run();

		const updated = await this.db
			.prepare("SELECT * FROM experiences WHERE id = ?1")
			.bind(id)
			.first<ExperienceRow>();
		return this.mapRow(updated!);
	}

	/**
	 * @description Delete an experience.
	 * @param { number } id Experience id
	 * @returns { Promise<boolean> } True if a row was removed
	 */
	async delete(id: number): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM experiences WHERE id = ?1")
			.bind(id)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Return experiences grouped by company for the resume
	 * timeline view. Uses timeline order under the hood so the ongoing role
	 * surfaces first and companies land in chronologically-plausible order
	 * (first-seen = first in the result array thanks to Map insertion order).
	 * Skills come from the `experience_tech_stacks` junction, mapped to the
	 * { name, icon, url } shape the client expects.
	 *
	 * Pagination is over *companies*, not experiences — otherwise pagination
	 * could split a company's role list across pages and break the grouped
	 * shape. For a typical resume (<10 companies, <50 experiences) grouping
	 * in memory is cheap; bump to SQL-side DISTINCT pagination if scale ever
	 * stops fitting in a single query.
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<TimelineCompany>> } Paginated companies
	 */
	async getTimeline({ page, limit }: PaginationParams): Promise<PaginatedResult<TimelineCompany>> {
		// Fetch active experiences in timeline order. Inactive rows (status = 0)
		// stay out of the public timeline; admins can toggle via PATCH.
		const timelineOrder = `COALESCE(end_date, '9999-12-31') DESC, start_date DESC`;
		const rowsResult = await this.db
			.prepare(`SELECT * FROM experiences WHERE status = 1 ORDER BY ${timelineOrder}`)
			.all<ExperienceRow>();
		const rows = (rowsResult.results as ExperienceRow[]) ?? [];
		if (rows.length === 0) {
			return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
		}

		const ids = rows.map((r) => r.id);
		const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
		const skillsResult = await this.db
			.prepare(
				`SELECT ets.experience_id, ts.name, ts.logo_url, ts.url
				 FROM experience_tech_stacks ets
				 JOIN tech_stacks ts ON ts.id = ets.tech_stack_id
				 WHERE ets.experience_id IN (${placeholders})
				 ORDER BY ts.name ASC`,
			)
			.bind(...ids)
			.all<{ experience_id: number; name: string; logo_url: string; url: string }>();

		const skillsByExperience = new Map<number, TimelineSkill[]>();
		for (const s of skillsResult.results as Array<{ experience_id: number; name: string; logo_url: string; url: string }>) {
			const bucket = skillsByExperience.get(s.experience_id) ?? [];
			bucket.push({ name: s.name, icon: s.logo_url, url: s.url });
			skillsByExperience.set(s.experience_id, bucket);
		}

		// Group by company name. Map preserves insertion order, so the first
		// experience of each company (the most-recent per timeline order) sets
		// that company's position in the result.
		const now = new Date();
		const byCompany = new Map<string, TimelineCompany>();
		for (const row of rows) {
			const role: TimelineRole = {
				title: row.title,
				period: buildPeriod(row.start_date, row.end_date, now),
				skills: skillsByExperience.get(row.id) ?? [],
			};
			const existing = byCompany.get(row.company);
			if (existing) {
				existing.roles.push(role);
			} else {
				byCompany.set(row.company, {
					company: row.company,
					url: row.company_url,
					logo: row.logo_url,
					roles: [role],
				});
			}
		}

		const all = Array.from(byCompany.values());
		const total = all.length;
		const offset = (page - 1) * limit;
		const data = all.slice(offset, offset + limit);
		return {
			data,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	/**
	 * @description Replace the full set of skills linked to an experience.
	 * Deletes then re-inserts with INSERT OR IGNORE so duplicate ids in the
	 * input are silently collapsed by the junction's composite PK.
	 * @param { number } experienceId Experience id
	 * @param { number[] } techStackIds Tech-stack ids to link
	 * @returns { Promise<void> }
	 */
	async setSkills(experienceId: number, techStackIds: number[]): Promise<void> {
		await this.db
			.prepare("DELETE FROM experience_tech_stacks WHERE experience_id = ?1")
			.bind(experienceId)
			.run();
		if (techStackIds.length === 0) return;
		const unique = Array.from(new Set(techStackIds));
		await this.db.batch(
			unique.map((tsId) =>
				this.db
					.prepare("INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id) VALUES (?1, ?2)")
					.bind(experienceId, tsId),
			),
		);
	}

	/**
	 * @description Attach a single tech stack to an experience. Idempotent —
	 * repeat attach is a no-op thanks to INSERT OR IGNORE on the composite PK.
	 * @param { number } experienceId Experience id
	 * @param { number } techStackId Tech stack id
	 * @returns { Promise<boolean> } True if a new link was created, false if it already existed
	 */
	async attachSkill(experienceId: number, techStackId: number): Promise<boolean> {
		const res = await this.db
			.prepare("INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id) VALUES (?1, ?2)")
			.bind(experienceId, techStackId)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}

	/**
	 * @description Detach a single tech stack from an experience.
	 * @param { number } experienceId Experience id
	 * @param { number } techStackId Tech stack id
	 * @returns { Promise<boolean> } True if a row was removed
	 */
	async detachSkill(experienceId: number, techStackId: number): Promise<boolean> {
		const res = await this.db
			.prepare("DELETE FROM experience_tech_stacks WHERE experience_id = ?1 AND tech_stack_id = ?2")
			.bind(experienceId, techStackId)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}

	/**
	 * @description Map a DB row to the public Experience shape.
	 * @param { ExperienceRow } row Raw DB row
	 * @returns { Experience } Public experience
	 */
	private mapRow(row: ExperienceRow): Experience {
		return {
			id: row.id,
			title: row.title,
			company: row.company,
			description: row.description,
			startDate: row.start_date,
			endDate: row.end_date,
			location: row.location,
			employmentType: row.employment_type,
			companyUrl: row.company_url,
			logoUrl: row.logo_url,
			cover: row.cover,
			status: row.status === 0 ? 0 : 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
