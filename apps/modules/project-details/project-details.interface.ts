export interface ProjectDetail {
	id: string;
	projectId: string;
	content: string;
	demoUrl: string;
	repoUrl: string;
	techStack: string[];
	status: 'in-progress' | 'completed' | 'archived';
	createdAt: string;
	updatedAt: string;
}

export interface ProjectDetailRow {
	id: string;
	project_id: string;
	content: string;
	demo_url: string;
	repo_url: string;
	tech_stack: string;
	status: string;
	created_at: string;
	updated_at: string;
}

export interface IProjectDetailRepository {
	findByProjectId(projectId: string): Promise<ProjectDetail | null>;
}
