import { SITE_URL } from "../../shared/config/site";
import { LlmsService } from "./llms.service";
import {
	buildAboutLlms,
	buildArticleLlms,
	buildContactLlms,
	buildIndexLlms,
	buildProjectLlms,
} from "./llms.builder";
import type { LlmsUrls } from "./llms.interface";

/** Slugs are parameterised in SQL; this cap just rejects absurd inputs before touching D1. */
const MAX_SLUG_LENGTH = 200;

const TEXT_HEADERS = {
	// llms.txt is Markdown, served as text/plain so browsers display it instead of downloading.
	'Content-Type': 'text/plain; charset=utf-8',
	// Content changes rarely; let browsers/CDNs reuse it briefly.
	'Cache-Control': 'public, max-age=300, s-maxage=3600',
};

function text(body: string, status = 200): Response {
	return new Response(body, { status, headers: TEXT_HEADERS });
}

function notFound(what: string): Response {
	return new Response(`# Not found\n\n> No public ${what} exists at this address.\n`, {
		status: 404,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

function urlsFor(request: Request): LlmsUrls {
	return { siteUrl: SITE_URL, llmsBaseUrl: new URL(request.url).origin };
}

function validSlug(slug: string | undefined): slug is string {
	return typeof slug === 'string' && slug.length > 0 && slug.length <= MAX_SLUG_LENGTH;
}

/**
 * @description Generates llms.txt documents (https://llmstxt.org) from live content
 * so each public page has a machine-readable twin, e.g.
 * `/articles/my-slug` → `/articles/my-slug/llms.txt`.
 */
export class LlmsController {
	static async index(request: Request, env: Env): Promise<Response> {
		const data = await new LlmsService(env.DB).getIndex();
		return text(buildIndexLlms(data, urlsFor(request)));
	}

	static async article(request: Request, env: Env, slug: string | undefined): Promise<Response> {
		if (!validSlug(slug)) return notFound('article');
		const article = await new LlmsService(env.DB).getArticle(slug);
		return article ? text(buildArticleLlms(article, urlsFor(request))) : notFound('article');
	}

	static async project(request: Request, env: Env, slug: string | undefined): Promise<Response> {
		if (!validSlug(slug)) return notFound('project');
		const project = await new LlmsService(env.DB).getProject(slug);
		return project ? text(buildProjectLlms(project, urlsFor(request))) : notFound('project');
	}

	static async about(request: Request, env: Env): Promise<Response> {
		const data = await new LlmsService(env.DB).getAbout();
		return text(buildAboutLlms(data, urlsFor(request)));
	}

	static async contact(request: Request, env: Env): Promise<Response> {
		const data = await new LlmsService(env.DB).getContact();
		return text(buildContactLlms(data, urlsFor(request)));
	}
}
