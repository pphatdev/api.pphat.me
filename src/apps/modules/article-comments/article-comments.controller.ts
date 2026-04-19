import { json } from "../../../shared/helpers/json";
import { ArticleCommentRepository } from "./article-comments.repo";
import {
	CreateArticleComment,
	DeleteArticleComment,
	ListArticleComments,
	UpdateArticleComment,
} from "./article-comments.service";

export class ArticleCommentsController {
	static async handle(request: Request, env: Env, articleId: string, commentId?: string): Promise<Response> {
		const repo = new ArticleCommentRepository(env.DB);
		const method = request.method;

		// Detail: /v1/api/articles/:slug/comments/:id
		if (commentId) {
			const numericId = Number(commentId);
			if (!Number.isInteger(numericId) || numericId <= 0) {
				return json({ error: "Invalid comment id" }, 400);
			}

			if (method === "PATCH") {
				const body = await request.json().catch(() => null);
				if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
				const { content } = body as Record<string, unknown>;
				if (!content || typeof content !== "string") return json({ error: "content is required" }, 422);
				const comment = await new UpdateArticleComment(repo).execute(numericId, { content });
				if (!comment) return json({ error: "Not Found" }, 404);
				return json(comment);
			}

			if (method === "DELETE") {
				const deleted = await new DeleteArticleComment(repo).execute(numericId);
				if (!deleted) return json({ error: "Not Found" }, 404);
				return new Response(null, { status: 204 });
			}

			return json({ error: "Method Not Allowed" }, 405);
		}

		// Collection: /v1/api/articles/:slug/comments
		if (method === "GET") {
			const url = new URL(request.url);
			const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
			const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
			const result = await new ListArticleComments(repo).execute(articleId, { page, limit });
			return json(result);
		}

		if (method === "POST") {
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
			const { authorName, content } = body as Record<string, unknown>;
			if (!authorName || typeof authorName !== "string") return json({ error: "authorName is required" }, 422);
			if (!content || typeof content !== "string") return json({ error: "content is required" }, 422);
			const comment = await new CreateArticleComment(repo).execute(articleId, { authorName, content });
			return json(comment, 201);
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
