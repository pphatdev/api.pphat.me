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

export interface CreateProjectDetailDto {
	content?: string;
	demoUrl?: string;
	repoUrl?: string;
	techStack?: string[];
	status?: 'in-progress' | 'completed' | 'archived';
}

export interface UpdateProjectDetailDto {
	content?: string;
	demoUrl?: string;
	repoUrl?: string;
	techStack?: string[];
	status?: 'in-progress' | 'completed' | 'archived';
}

export interface IProjectDetailRepository {
	findByProjectId(projectId: string): Promise<ProjectDetail | null>;
	upsert(projectId: string, dto: CreateProjectDetailDto): Promise<ProjectDetail>;
	delete(projectId: string): Promise<boolean>;
}
