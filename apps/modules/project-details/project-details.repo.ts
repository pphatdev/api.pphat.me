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

	async findByProjectId(projectId: string): Promise<ProjectDetail | null> {
		const row = await this.db
			.prepare("SELECT * FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<ProjectDetailRow>();
		if (!row) return null;
		return this.mapRow(row);
	}

	async upsert(projectId: string, dto: CreateProjectDetailDto | UpdateProjectDetailDto): Promise<ProjectDetail> {
		const existing = await this.db
			.prepare("SELECT * FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<ProjectDetailRow>();

		const now = new Date().toISOString();

		if (!existing) {
			const id = crypto.randomUUID();
			const safeStatus = ALLOWED_STATUS.includes(dto.status ?? '') ? dto.status! : 'in-progress';
			await this.db
				.prepare(
					"INSERT INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
				)
				.bind(
					id,
					projectId,
					dto.content ?? '',
					dto.demoUrl ?? '',
					dto.repoUrl ?? '',
					JSON.stringify(dto.techStack ?? []),
					safeStatus,
					now,
					now,
				)
				.run();
		} else {
			const fields: string[] = [];
			const values: unknown[] = [];
			let idx = 1;

			if (dto.content !== undefined)   { fields.push(`content = ?${idx++}`);    values.push(dto.content); }
			if (dto.demoUrl !== undefined)   { fields.push(`demo_url = ?${idx++}`);   values.push(dto.demoUrl); }
			if (dto.repoUrl !== undefined)   { fields.push(`repo_url = ?${idx++}`);   values.push(dto.repoUrl); }
			if (dto.techStack !== undefined) { fields.push(`tech_stack = ?${idx++}`); values.push(JSON.stringify(dto.techStack)); }
			if (dto.status !== undefined && ALLOWED_STATUS.includes(dto.status)) {
				fields.push(`status = ?${idx++}`);
				values.push(dto.status);
			}

			fields.push(`updated_at = ?${idx++}`);
			values.push(now);
			values.push(projectId);

			await this.db
				.prepare(`UPDATE project_details SET ${fields.join(", ")} WHERE project_id = ?${idx}`)
				.bind(...values)
				.run();
		}

		const row = await this.db
			.prepare("SELECT * FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<ProjectDetailRow>();
		return this.mapRow(row!);
	}

	async delete(projectId: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.run();
		return result.meta.changes > 0;
	}

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
