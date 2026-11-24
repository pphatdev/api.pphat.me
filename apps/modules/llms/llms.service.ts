import { ArticleRepository } from "../articles/articles.repo";
import { ProjectRepository } from "../projects/projects.repo";
import { AboutMeRepository } from "../about-me/about-me.repo";
import { FaqRepository } from "../faqs/faqs.repo";
import type { Article } from "../articles/articles.interface";
import type { Project } from "../projects/projects.interface";
import type { Faq } from "../faqs/faqs.interface";
import type { LlmsAboutInput, LlmsContactInput, LlmsIndexInput } from "./llms.interface";

/** Upper bound on items listed in the site index (keeps D1 reads and CPU bounded). */
const INDEX_LIMIT = 100;
/** FAQ category shown on the About page. */
const ABOUT_FAQ_CATEGORY = 'About';

/**
 * @description Loads ONLY publicly visible data for llms.txt generation:
 * published+public articles, published projects, the active About Me entry and
 * active FAQs. Contact-form submissions are never read.
 */
export class LlmsService {
	private readonly articles: ArticleRepository;
	private readonly projects: ProjectRepository;
	private readonly aboutMe: AboutMeRepository;
	private readonly faqs: FaqRepository;

	constructor(db: D1Database) {
		this.articles = new ArticleRepository(db);
		this.projects = new ProjectRepository(db);
		this.aboutMe = new AboutMeRepository(db);
		this.faqs = new FaqRepository(db);
	}

	async getIndex(): Promise<LlmsIndexInput> {
		const [about, articles, projects] = await Promise.all([
			this.aboutMe.findActive(),
			// onlyPublished=true without admin ⇒ `published=1 AND is_public=1`
			this.articles.findAll({ page: 1, limit: INDEX_LIMIT }, true),
			this.projects.findAll({ page: 1, limit: INDEX_LIMIT }, true),
		]);
		return { about, articles: articles.data, projects: projects.data };
	}

	async getArticle(slug: string): Promise<Article | null> {
		const article = await this.articles.findBySlug(slug);
		// Drafts, private and scheduled (not yet promoted) articles must not leak.
		return article && article.published && article.isPublic ? article : null;
	}

	async getProject(slug: string): Promise<Project | null> {
		const project = await this.projects.findBySlug(slug);
		return project && project.published ? project : null;
	}

	async getAbout(): Promise<LlmsAboutInput> {
		const [about, faqs] = await Promise.all([
			this.aboutMe.findActive(),
			this.activeFaqs({ category: ABOUT_FAQ_CATEGORY }),
		]);
		return { about, faqs };
	}

	async getContact(): Promise<LlmsContactInput> {
		const [about, matches] = await Promise.all([
			this.aboutMe.findActive(),
			this.activeFaqs({ search: 'contact' }),
		]);
		// Search also matches answers that merely mention "contact"; keep FAQs that are about contacting.
		const contactFaqs = matches.filter((f) => /contact/i.test(f.slug) || /contact/i.test(f.question));
		return { about, contactFaqs };
	}

	private async activeFaqs(filter: { category?: string; search?: string }): Promise<Faq[]> {
		const result = await this.faqs.findAll({ page: 1, limit: 50, onlyActive: true, ...filter });
		return result.data;
	}
}
