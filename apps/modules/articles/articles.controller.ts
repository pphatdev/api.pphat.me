import { json } from "../../shared/helpers/json";
import { ArticleRepository } from "./articles.repo";
import {
	CreateArticle,
	DeleteArticle,
	GetArticleBySlug,
	ListArticles,
	UpdateArticle,
} from "./articles.service";

export class ArticlesController {
	static async handle(request: Request, env: Env, slug?: string): Promise<Response> {
		const repository = new ArticleRepository(env.DB);
		const method = request.method;

		// Collection: /v1/api/articles
		if (!slug) {
			if (method === "GET") {
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

			if (method === "POST") {
				const body = await request.json().catch(() => null);
				if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

				const { title, slug: bodySlug, description } = body as Record<string, unknown>;
				if (!title || !bodySlug || !description) {
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

			return json({ error: "Method Not Allowed" }, 405);
		}

		// Detail: /v1/api/articles/:slug
		if (method === "GET") {
			const article = await new GetArticleBySlug(repository).execute(slug);
			if (!article) return json({ error: "Not Found" }, 404);
			return json(article);
		}

		if (method === "PUT" || method === "PATCH") {
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

		if (method === "DELETE") {
			const deleted = await new DeleteArticle(repository).execute(slug);
			if (!deleted) return json({ error: "Not Found" }, 404);
			return new Response(null, { status: 204 });
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
