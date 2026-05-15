import type {
	ProjectDetail,
	ProjectDetailRow,
	IProjectDetailRepository,
	CreateProjectDetailDto,
	UpdateProjectDetailDto,
} from "./project-details.interface";

const ALLOWED_STATUS = ['in-progress', 'completed', 'archived'];

export class ProjectDetailRepository implements IProjectDetailRepository {
	constructor(private readonly db: D1Database) {}

	/**
	 * @description Find project details by project ID
	 * @param { string } projectId The project UUID
	 * @returns { Promise<ProjectDetail | null> } The details or null
	 */
	async findByProjectId(projectId: string): Promise<ProjectDetail | null> {
		const row = await this.db
			.prepare("SELECT * FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<ProjectDetailRow>();
		if (!row) return null;
		return this.mapRow(row);
	}

	/**
	 * @description Upsert project details in the database
	 * @param { string } projectId The project UUID
	 * @param { CreateProjectDetailDto | UpdateProjectDetailDto } dto Details data
	 * @returns { Promise<ProjectDetail> } The upserted details
	 */
	async upsert(projectId: string, dto: CreateProjectDetailDto | UpdateProjectDetailDto): Promise<ProjectDetail> {
		const existing = await this.findByProjectId(projectId);
		const now = new Date().toISOString();

		if (!existing) {
			await this.insertRow(projectId, dto, now);
		} else {
			await this.updateRow(projectId, dto, now);
		}

		return (await this.findByProjectId(projectId))!;
	}

	/**
	 * @description Internal: insert a new project details row
	 * @param { string } projectId Project ID
	 * @param { any } dto Details data
	 * @param { string } now Timestamp
	 * @returns { Promise<void> }
	 */
	private async insertRow(projectId: string, dto: any, now: string): Promise<void> {
		const safeStatus = ALLOWED_STATUS.includes(dto.status ?? '') ? dto.status! : 'in-progress';
		await this.db
			.prepare(
				"INSERT INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
			)
			.bind(
				crypto.randomUUID(), projectId,
				dto.content ?? '', dto.demoUrl ?? '', dto.repoUrl ?? '',
				JSON.stringify(dto.techStack ?? []), safeStatus, now, now
			)
			.run();
	}

	/**
	 * @description Internal: update an existing project details row
	 * @param { string } projectId Project ID
	 * @param { any } dto Details data
	 * @param { string } now Timestamp
	 * @returns { Promise<void> }
	 */
	private async updateRow(projectId: string, dto: any, now: string): Promise<void> {
		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		const mappings: [string, string, ((v: any) => any)?][] = [
			['content', 'content'],
			['demoUrl', 'demo_url'],
			['repoUrl', 'repo_url'],
			['techStack', 'tech_stack', (v) => JSON.stringify(v)],
			['status', 'status', (v) => (ALLOWED_STATUS.includes(v) ? v : undefined)],
		];

		for (const [key, field, transform] of mappings) {
			if (dto[key] !== undefined) {
				const val = transform ? transform(dto[key]) : dto[key];
				if (val !== undefined) {
					fields.push(`${field} = ?${idx++}`);
					values.push(val);
				}
			}
		}

		if (fields.length > 0) {
			fields.push(`updated_at = ?${idx++}`);
			values.push(now);
			values.push(projectId);
			await this.db.prepare(`UPDATE project_details SET ${fields.join(", ")} WHERE project_id = ?${idx}`).bind(...values).run();
		}
	}

	/**
	 * @description Delete project details from the database
	 * @param { string } projectId Project ID
	 * @returns { Promise<boolean> } True if changes occurred
	 */
	async delete(projectId: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Internal: map database row to ProjectDetail object
	 * @param { ProjectDetailRow } row The database row
	 * @returns { ProjectDetail } The mapped details
	 */
	private mapRow(row: ProjectDetailRow): ProjectDetail {
		return {
			id: row.id,
			projectId: row.project_id,
			content: row.content,
			demoUrl: row.demo_url,
			repoUrl: row.repo_url,
			techStack: JSON.parse(row.tech_stack || '[]'),
			status: row.status as ProjectDetail['status'],
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
