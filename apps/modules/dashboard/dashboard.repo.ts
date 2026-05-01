import { IDashboardRepository, DashboardData } from "./dashboard.interface";
import { IArticleRepository } from "../articles/articles.interface";
import { IProjectRepository } from "../projects/projects.interface";
import { IAuthorRepository } from "../authors/authors.interface";

export class DashboardRepository implements IDashboardRepository {
	constructor(
		private readonly db: D1Database,
		private readonly articleRepo: IArticleRepository,
		private readonly projectRepo: IProjectRepository,
		private readonly authorRepo: IAuthorRepository
	) {}

	async getDashboardData(): Promise<DashboardData> {
		const [
			blogStats,
			projectStats,
			liveTraffic,
			topPosts,
			topProjects,
			newestPosts,
			newestProjects,
			newestContributors
		] = await Promise.all([
			this.articleRepo.getStatsSummary(),
			this.projectRepo.getStatsSummary(),
			this.getLiveTraffic(),
			this.articleRepo.findTop(5),
			this.projectRepo.findTop(5),
			this.articleRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' }, false),
			this.projectRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' }, false),
			this.authorRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' } as any)
		]);

		return {
			blogs: blogStats,
			projects: projectStats,
			liveTraffic,
			topPosts,
			topProjects,
			newestPosts: newestPosts.data,
			newestProjects: newestProjects.data,
			newestContributors: newestContributors.data
		};
	}

	public async getLiveTraffic(): Promise<number> {
		// Active visitors in the last 5 minutes from DB
		const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		const row = await this.db
			.prepare("SELECT COUNT(DISTINCT ip_hash) as count FROM visitor_logs WHERE timestamp > ?1")
			.bind(fiveMinsAgo)
			.first<{ count: number }>();
		return row?.count ?? 0;
	}
}
