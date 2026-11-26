import type { Article } from "../articles/articles.interface";
import type { Project } from "../projects/projects.interface";
import type { AboutMe } from "../about-me/about-me.interface";
import type { Faq } from "../faqs/faqs.interface";
import { SITE_NAME } from "../../shared/config/site";
import type { LlmsAboutInput, LlmsContactInput, LlmsIndexInput, LlmsListItem, LlmsUrls } from "./llms.interface";

/**
 * Pure renderers for llms.txt documents (https://llmstxt.org): an H1 title,
 * a `>` summary, optional detail lines, then `##` sections of links/content.
 * No DB access here, so every format decision is unit-testable.
 */

/** Collapse whitespace/newlines so a value is safe on a single Markdown line. */
export function inline(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Escape characters that would break a Markdown link label: `[`, `]` and the
 * backslash itself. Without escaping `\`, a title ending in `\` turns the
 * added `\]` into `\\]` (escaped backslash + live `]`) and closes the label
 * early (CodeQL js/incomplete-sanitization).
 */
function linkLabel(value: string): string {
	return inline(value).replace(/([\\[\]])/g, '\\$1');
}

function isoDate(value: string | null | undefined): string {
	return value ? value.slice(0, 10) : '';
}

/** Drop a leading `# Heading` that merely repeats the document title. */
export function stripLeadingTitle(markdown: string, title: string): string {
	const trimmed = markdown.replace(/^\s+/, '');
	const match = /^#\s+(.+?)\s*(?:\r?\n|$)/.exec(trimmed);
	if (match && inline(match[1]).toLowerCase() === inline(title).toLowerCase()) {
		return trimmed.slice(match[0].length).replace(/^\s+/, '');
	}
	return trimmed;
}

/** Render `- Label: value` lines, skipping empty values. */
function details(rows: Array<[label: string, value: string | number | null | undefined]>): string[] {
	return rows
		.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
		.map(([label, value]) => `- ${label}: ${inline(String(value))}`);
}

function doc(lines: Array<string | false | null | undefined>): string {
	// Collapse runs of blank lines produced by optional sections, end with one newline.
	return lines
		.filter((l): l is string => typeof l === 'string')
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim() + '\n';
}

function displayName(about: AboutMe | null): string {
	return inline(about?.name) || SITE_NAME;
}

function listLinks(items: LlmsListItem[], kind: 'articles' | 'projects', urls: LlmsUrls): string[] {
	return items.map((item) => {
		const desc = inline(item.description);
		return `- [${linkLabel(item.title)}](${urls.llmsBaseUrl}/${kind}/${item.slug}/llms.txt)${desc ? `: ${desc}` : ''}`;
	});
}

function faqSection(heading: string, faqs: Faq[]): string[] {
	if (faqs.length === 0) return [];
	const out = ['', `## ${heading}`, ''];
	for (const faq of faqs) {
		out.push(`### ${inline(faq.question)}`, '', stripLeadingTitle(faq.answer, faq.question).trim(), '');
	}
	return out;
}

// ── Site index: /llms.txt ──────────────────────────────────────────────────
export function buildIndexLlms({ about, articles, projects }: LlmsIndexInput, urls: LlmsUrls): string {
	const name = displayName(about);
	const summary = [inline(about?.role), inline(about?.location)].filter(Boolean).join(' based in ');

	return doc([
		`# ${SITE_NAME}`,
		'',
		`> Portfolio and blog of ${name}${summary ? `, ${summary}` : ''}. Each page below has its own llms.txt with the full content.`,
		'',
		'## Pages',
		'',
		`- [About](${urls.llmsBaseUrl}/about/llms.txt): Who ${name} is, background and FAQ`,
		`- [Contact](${urls.llmsBaseUrl}/contact/llms.txt): How to get in touch`,
		articles.length > 0 && '',
		articles.length > 0 && '## Articles',
		articles.length > 0 && '',
		...listLinks(articles, 'articles', urls),
		projects.length > 0 && '',
		projects.length > 0 && '## Projects',
		projects.length > 0 && '',
		...listLinks(projects, 'projects', urls),
		'',
		'## Optional',
		'',
		`- [Website](${urls.siteUrl}): Human-readable portfolio site`,
	]);
}

// ── Article: /articles/:slug/llms.txt ─────────────────────────────────────
export function buildArticleLlms(article: Article, urls: LlmsUrls): string {
	const authors = article.authors.map((a) => inline(a.name)).filter(Boolean).join(', ');
	const tags = article.tags.map((t) => inline(t.tag)).filter(Boolean).join(', ');
	const body = stripLeadingTitle(article.content ?? '', article.title);

	return doc([
		`# ${inline(article.title)}`,
		'',
		inline(article.description) && `> ${inline(article.description)}`,
		'',
		...details([
			['URL', `${urls.siteUrl}/articles/${article.slug}`],
			['Author', authors],
			['Tags', tags],
			['Published', isoDate(article.publishAt ?? article.createdAt)],
			['Updated', isoDate(article.updatedAt)],
			['Reading time', article.stats?.readingMins ? `${article.stats.readingMins} min` : ''],
		]),
		body && '',
		body && '## Article',
		body && '',
		body,
		'',
		'## Related',
		'',
		`- [All pages](${urls.llmsBaseUrl}/llms.txt): Index of ${SITE_NAME}`,
		`- [About the author](${urls.llmsBaseUrl}/about/llms.txt)`,
	]);
}

// ── Project: /projects/:slug/llms.txt ─────────────────────────────────────
export function buildProjectLlms(project: Project, urls: LlmsUrls): string {
	const d = project.details;
	const stack = Array.from(new Set([...(d?.techStack ?? []), ...(project.languages ?? [])].map(inline).filter(Boolean)));
	const tags = project.tags.map((t) => inline(t.tag)).filter(Boolean).join(', ');
	const contributors = project.contributors.map((c) => inline(c.name)).filter(Boolean).join(', ');
	const body = stripLeadingTitle(d?.content ?? '', project.title);

	return doc([
		`# ${inline(project.title)}`,
		'',
		inline(project.description) && `> ${inline(project.description)}`,
		'',
		...details([
			['URL', `${urls.siteUrl}/projects/${project.slug}`],
			['Status', d?.status],
			['Tech stack', stack.join(', ')],
			['Tags', tags],
			['Contributors', contributors],
			['Live demo', d?.demoUrl],
			['Source code', d?.repoUrl],
			['Updated', isoDate(project.updatedAt)],
		]),
		body && '',
		body && '## Project',
		body && '',
		body,
		'',
		'## Related',
		'',
		`- [All pages](${urls.llmsBaseUrl}/llms.txt): Index of ${SITE_NAME}`,
		`- [About the author](${urls.llmsBaseUrl}/about/llms.txt)`,
	]);
}

// ── About: /about/llms.txt ─────────────────────────────────────────────────
export function buildAboutLlms({ about, faqs }: LlmsAboutInput, urls: LlmsUrls): string {
	const name = displayName(about);
	const bio = (about?.description ?? '').trim();

	return doc([
		`# About ${name}`,
		'',
		inline(about?.title) && `> ${inline(about?.title)}`,
		'',
		...details([
			['URL', `${urls.siteUrl}/about`],
			['Name', about?.name],
			['Also known as', about?.nickname],
			['Role', about?.role],
			['Location', about?.location],
		]),
		bio && '',
		bio && '## Biography',
		bio && '',
		bio,
		...faqSection('Frequently asked questions', faqs),
		'',
		'## Related',
		'',
		`- [Contact](${urls.llmsBaseUrl}/contact/llms.txt): How to get in touch`,
		`- [All pages](${urls.llmsBaseUrl}/llms.txt): Index of ${SITE_NAME}`,
	]);
}

// ── Contact: /contact/llms.txt ─────────────────────────────────────────────
export function buildContactLlms({ about, contactFaqs }: LlmsContactInput, urls: LlmsUrls): string {
	const name = displayName(about);

	return doc([
		`# Contact ${name}`,
		'',
		`> How to reach ${name}${inline(about?.role) ? `, ${inline(about?.role)}` : ''}.`,
		'',
		...details([
			['URL', `${urls.siteUrl}/contact`],
			['Location', about?.location],
		]),
		'',
		'## Contact form',
		'',
		`Send a message through the contact page at ${urls.siteUrl}/contact. It asks for your name, email address, an optional subject and your message.`,
		...faqSection('Contact details', contactFaqs),
		'',
		'## Related',
		'',
		`- [About](${urls.llmsBaseUrl}/about/llms.txt): Who ${name} is`,
		`- [All pages](${urls.llmsBaseUrl}/llms.txt): Index of ${SITE_NAME}`,
	]);
}
