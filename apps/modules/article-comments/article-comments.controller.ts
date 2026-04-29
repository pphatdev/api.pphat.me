import { Res } from "../../shared/helpers/response";
import { isObject } from "../../shared/helpers/json";
import { parseListParams } from "../../shared/helpers/query";
import { ArticleCommentRepository } from "./article-comments.repo";
import { ArticleCommentService } from "./article-comments.service";

export class ArticleCommentsController {

	private static validateCommentId(commentId: string): number | null {
		const numericId = Number(commentId);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	private static async parseBody(request: Request): Promise<any> {
		return request.json().catch(() => null);
	}

	private static validateContent(content: unknown): string | null {
		return (typeof content === "string" && content.trim()) ? content : null;
	}

	static async list(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleCommentRepository(env.DB);
		const params = parseListParams(request.url);
		const result = await new ArticleCommentService(repo).list(articleId, params);
		return Res.ok(result);
	}

	static async create(request: Request, env: Env, articleId: string): Promise<Response> {
		const body = await this.parseBody(request);
		if (!isObject(body)) return Res.badRequest("Invalid request body. Expected JSON.");
		
		const { authorName, content } = body;
		if (!authorName || typeof authorName !== "string") return Res.unprocessable("authorName is required");
		
		const validContent = this.validateContent(content);
		if (!validContent) return Res.unprocessable("content is required");
		
		const repo = new ArticleCommentRepository(env.DB);
		const comment = await new ArticleCommentService(repo).create(articleId, { authorName, content: validContent });
		return Res.created(comment);
	}

	static async update(request: Request, env: Env, articleId: string, commentId: string): Promise<Response> {
		const numericId = this.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const body = await this.parseBody(request);
		if (!isObject(body)) return Res.badRequest("Invalid request body. Expected JSON.");
		
		const validContent = this.validateContent(body.content);
		if (!validContent) return Res.unprocessable("content is required");
		
		const repo = new ArticleCommentRepository(env.DB);
		const comment = await new ArticleCommentService(repo).update(numericId, { content: validContent });
		if (!comment) return Res.notFound();
		return Res.ok(comment);
	}

	static async delete(request: Request, env: Env, articleId: string, commentId: string): Promise<Response> {
		const numericId = this.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const repo = new ArticleCommentRepository(env.DB);
		const deleted = await new ArticleCommentService(repo).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
