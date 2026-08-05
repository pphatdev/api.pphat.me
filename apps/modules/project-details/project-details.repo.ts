import type {
	ProjectDetail,
	ProjectDetailRow,
	IProjectDetailRepository,
} from "./project-details.interface";

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
