import { Res } from "../../shared/helpers/response";
import { ArticleCommentRepository } from "./article-comments.repo";
import { ArticleCommentService } from "./article-comments.service";

export class ArticleCommentsController {

	private static validateCommentId(commentId: string): number | null {
		const numericId = Number(commentId);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	static async list(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleCommentRepository(env.DB);
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const result = await new ArticleCommentService(repo).list(articleId, { page, limit });
		return Res.ok(result);
	}

	static async create(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleCommentRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const { authorName, content } = body as Record<string, unknown>;
		if (!authorName || typeof authorName !== "string") return Res.unprocessable("authorName is required");
		if (!content || typeof content !== "string") return Res.unprocessable("content is required");
		const comment = await new ArticleCommentService(repo).create(articleId, { authorName, content });
		return Res.created(comment);
	}

	static async update(request: Request, env: Env, articleId: string, commentId: string): Promise<Response> {
		const numericId = ArticleCommentsController.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const repo = new ArticleCommentRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const { content } = body as Record<string, unknown>;
		if (!content || typeof content !== "string") return Res.unprocessable("content is required");
		const comment = await new ArticleCommentService(repo).update(numericId, { content });
		if (!comment) return Res.notFound();
		return Res.ok(comment);
	}

	static async delete(request: Request, env: Env, articleId: string, commentId: string): Promise<Response> {
		const numericId = ArticleCommentsController.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const repo = new ArticleCommentRepository(env.DB);
		const deleted = await new ArticleCommentService(repo).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
