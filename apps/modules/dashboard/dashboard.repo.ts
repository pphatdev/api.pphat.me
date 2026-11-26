import { IDashboardRepository, DashboardData } from "./dashboard.interface";
import { IArticleRepository } from "../articles/articles.interface";
import { IProjectRepository } from "../projects/projects.interface";
import { IAuthorRepository } from "../authors/authors.interface";
import { ITechStackRepository } from "../tech-stacks/tech-stacks.interface";
import { IExperienceRepository } from "../experiences/experiences.interface";
import { ISkillRepository } from "../skills/skills.interface";

/** Window that counts as "live" traffic. */
const LIVE_WINDOW_MS = 5 * 60 * 1000;

/**
 * How long a live-traffic count is reused. Every open dashboard polls this
 * (SSE), so without sharing, N tabs cost N queries per poll. Equal to the SSE
 * poll interval; a 15s-stale count is fine for a 5-minute window.
 */
export const LIVE_TRAFFIC_TTL_MS = 15_000;

// Per-isolate cache shared by all requests/streams in this Worker instance.
// `pending` de-duplicates concurrent refreshes.
let liveTrafficCache: { value: number; expiresAt: number } | null = null;
let liveTrafficPending: Promise<number> | null = null;

/** @description Test hook: drop the cached live-traffic count. */
export function resetLiveTrafficCache(): void {
	liveTrafficCache = null;
	liveTrafficPending = null;
}

export class DashboardRepository implements IDashboardRepository {
	constructor(
		private readonly db: D1Database,
		private readonly articleRepo: IArticleRepository,
		private readonly projectRepo: IProjectRepository,
		private readonly authorRepo: IAuthorRepository,
		private readonly techStackRepo: ITechStackRepository,
		private readonly experienceRepo: IExperienceRepository,
		private readonly skillRepo: ISkillRepository,
	) {}

	/**
	 * @description Get all dashboard metrics and recent data
	 * @returns { Promise<DashboardData> } Consolidated dashboard data
	 */
	async getDashboardData(): Promise<DashboardData> {
		const [
			blogStats,
			projectStats,
			liveTraffic,
			topPosts,
			topProjects,
			newestPosts,
			newestProjects,
			newestContributors,
			newestTechStacks,
			newestExperiences,
			newestSkills,
		] = await Promise.all([
			this.articleRepo.getStatsSummary(),
			this.projectRepo.getStatsSummary(),
			this.getLiveTraffic(),
			this.articleRepo.findTop(5),
			this.projectRepo.findTop(5),
			this.articleRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' }, false),
			this.projectRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' }, false),
			this.authorRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' } as any),
			this.techStackRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' } as any),
			this.experienceRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' } as any),
			this.skillRepo.findAll({ page: 1, limit: 5, sort: ['created_at'], order: 'desc' } as any),
		]);

		return {
			blogs: blogStats,
			projects: projectStats,
			liveTraffic,
			topPosts,
			topProjects,
			newestPosts: newestPosts.data,
			newestProjects: newestProjects.data,
			newestContributors: newestContributors.data,
			newestTechStacks: newestTechStacks.data,
			newestExperiences: newestExperiences.data,
			newestSkills: newestSkills.data,
		};
	}

	/**
	 * @description Get number of distinct visitors in the last 5 minutes.
	 * Cached per isolate for LIVE_TRAFFIC_TTL_MS and de-duplicated while a
	 * refresh is in flight. The query is served by idx_visitor_logs_ts_ip
	 * (covering), so it reads only rows inside the window.
	 * @returns { Promise<number> } Active visitor count
	 */
	public async getLiveTraffic(): Promise<number> {
		const now = Date.now();
		if (liveTrafficCache && liveTrafficCache.expiresAt > now) return liveTrafficCache.value;
		if (liveTrafficPending) return liveTrafficPending;

		liveTrafficPending = (async () => {
			try {
				const since = new Date(now - LIVE_WINDOW_MS).toISOString();
				const row = await this.db
					.prepare("SELECT COUNT(DISTINCT ip_hash) as count FROM visitor_logs WHERE timestamp > ?1")
					.bind(since)
					.first<{ count: number }>();
				const value = row?.count ?? 0;
				liveTrafficCache = { value, expiresAt: Date.now() + LIVE_TRAFFIC_TTL_MS };
				return value;
			} finally {
				liveTrafficPending = null;
			}
		})();
		return liveTrafficPending;
	}
}
