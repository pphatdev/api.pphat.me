import { Res } from "../../shared/helpers/response";
import { isObject } from "../../shared/helpers/json";
import { parseListParams } from "../../shared/helpers/query";
import { ArticleCommentRepository } from "./article-comments.repo";
import { ArticleCommentService } from "./article-comments.service";

export class ArticleCommentsController {

	/**
	 * @description Validates and converts a comment ID to numeric format
	 * @param { string } commentId The comment ID string
	 * @returns { number | null } Numeric ID or null if invalid
	 */
	private static validateCommentId(commentId: string): number | null {
		const numericId = Number(commentId);
		if (!Number.isInteger(numericId) || numericId <= 0) return null;
		return numericId;
	}

	/**
	 * @description Safely parses the request body as JSON
	 * @param { Request } request The incoming request
	 * @returns { Promise<any> } Parsed JSON or null
	 */
	private static async parseBody(request: Request): Promise<any> {
		return request.json().catch(() => null);
	}

	/**
	 * @description Validates that the comment content is a non-empty string
	 * @param { unknown } content The content to validate
	 * @returns { string | null } Trimmed content or null if invalid
	 */
	private static validateContent(content: unknown): string | null {
		return (typeof content === "string" && content.trim()) ? content : null;
	}

	/**
	 * @description List comments for an article
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } Paginated list of comments
	 */
	static async list(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleCommentRepository(env.DB);
		const params = parseListParams(request.url);
		const result = await new ArticleCommentService(repo).list(articleId, params);
		return Res.ok(result);
	}

	/**
	 * @description Create a new comment for an article
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } The created comment
	 */
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

	/**
	 * @description Update an existing comment
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @param { string } commentId The comment ID
	 * @returns { Promise<Response> } The updated comment
	 */
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

	/**
	 * @description Delete a comment
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @param { string } commentId The comment ID
	 * @returns { Promise<Response> } No content response
	 */
	static async delete(request: Request, env: Env, articleId: string, commentId: string): Promise<Response> {
		const numericId = this.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const repo = new ArticleCommentRepository(env.DB);
		const deleted = await new ArticleCommentService(repo).delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
