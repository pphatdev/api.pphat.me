import type { Context, Next } from 'hono';
import { json } from "../../shared/helpers/json";
import { AppEnv } from "./articles.interface";
import { ArticleRepository } from "./articles.repo";
import { CreateArticle, DeleteArticle, GetArticleBySlug, ListArticles, UpdateArticle } from "./articles.service";
import { TagRepository } from "../tags/tags.repo";
import { ListTagsByArticle } from "../tags/tags.service";

export class ArticlesController {
	static resolveArticle = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const article = await c.env.DB
			.prepare('SELECT id FROM articles WHERE slug = ?1')
			.bind(c.req.param('slug'))
			.first<{ id: string }>();
		if (!article) return c.json({ error: 'Not Found' }, 404);
		c.set('articleId', article.id);
		return next();
	};


	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search = url.searchParams.get("search") ?? undefined;
		const sort = url.searchParams.get("sort") ?? undefined;
		const orderParam = url.searchParams.get("order")?.toLowerCase();
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const result = await new ListArticles(repository).execute({ page, limit, search, sort, order });
		return json(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const { title, slug, description } = body as Record<string, unknown>;
		if (!title || !slug || !description) {
			return json({ error: "title, slug and description are required" }, 422);
		}

		try {
			const article = await new CreateArticle(repository).execute(body as never);
			return json(article, 201);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: articles.slug")) {
				return json({ error: "An article with this slug already exists" }, 409);
			}
			throw err;
		}
	}

	static async getBySlug(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const article = await new GetArticleBySlug(repository).execute(slug);
		if (!article) return json({ error: "Not Found" }, 404);
		return json(article);
	}

	static async update(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		try {
			const article = await new UpdateArticle(repository).execute(slug, body as never);
			if (!article) return json({ error: "Not Found" }, 404);
			return json(article);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: articles.slug")) {
				return json({ error: "An article with this slug already exists" }, 409);
			}
			throw err;
		}
	}

	static async delete(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const deleted = await new DeleteArticle(repository).execute(slug);
		if (!deleted) return json({ error: "Not Found" }, 404);
		return new Response(null, { status: 204 });
	}

	static async getTagsArticle(c: Context<AppEnv>): Promise<Response> {
		const tags = await new ListTagsByArticle(new TagRepository(c.env.DB)).execute(c.get('articleId'));
		return c.json(tags);
	}
}
