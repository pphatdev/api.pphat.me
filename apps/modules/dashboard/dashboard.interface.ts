import { Article } from "../articles/articles.interface";
import { Project } from "../projects/projects.interface";
import { Author } from "../authors/authors.interface";
import { TechStack } from "../tech-stacks/tech-stacks.interface";
import { Experience } from "../experiences/experiences.interface";

export interface DashboardData {
	blogs: {
		total: number;
		published: number;
		draft: number;
	};
	projects: {
		total: number;
		published: number;
		draft: number;
	};
	liveTraffic: number;
	topPosts: Article[];
	topProjects: Project[];
	newestPosts: Article[];
	newestProjects: Project[];
	newestContributors: Author[];
	/** Most-recently created tech stacks — appears in the recent-activities feed. */
	newestTechStacks: TechStack[];
	/** Most-recently created experience entries — part of the recent-activities feed. */
	newestExperiences: Experience[];
}

export interface IDashboardRepository {
	getDashboardData(): Promise<DashboardData>;
}
