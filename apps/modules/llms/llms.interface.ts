import type { Article } from "../articles/articles.interface";
import type { Project } from "../projects/projects.interface";
import type { AboutMe } from "../about-me/about-me.interface";
import type { Faq } from "../faqs/faqs.interface";

/**
 * @description URLs used when rendering an llms.txt document.
 * - `siteUrl`: canonical public site (human-facing page links).
 * - `llmsBaseUrl`: origin that actually serves the llms.txt files (the request origin),
 *   so cross-links always resolve even before the public site proxies these paths.
 */
export interface LlmsUrls {
	siteUrl: string;
	llmsBaseUrl: string;
}

/** Summary entry used in index listings. */
export type LlmsListItem = Pick<Article | Project, 'title' | 'slug' | 'description'>;

export interface LlmsIndexInput {
	about: AboutMe | null;
	articles: LlmsListItem[];
	projects: LlmsListItem[];
}

export interface LlmsAboutInput {
	about: AboutMe | null;
	faqs: Faq[];
}

export interface LlmsContactInput {
	about: AboutMe | null;
	contactFaqs: Faq[];
}
