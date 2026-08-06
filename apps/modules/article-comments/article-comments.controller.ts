import { Res } from "../../shared/helpers/response";
import { isObject } from "../../shared/helpers/json";
import { parseListParams } from "../../shared/helpers/query";
import type { JwtPayload } from "../auth/auth.interface";
import { ArticleCommentRepository } from "./article-comments.repo";
import { ArticleCommentService } from "./article-comments.service";

const MAX_COMMENT_LENGTH = 5000;
const MAX_AUTHOR_NAME_LENGTH = 100;

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
	 * @description Validates that the comment content is a non-empty string within length limits
	 * @param { unknown } content The content to validate
	 * @returns { string | null } Trimmed content or null if invalid
	 */
	private static validateContent(content: unknown): string | null {
		if (typeof content !== "string") return null;
		const trimmed = content.trim();
		if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return null;
		return trimmed;
	}

	/**
	 * @description Strip HTML-tag markers and control chars from a raw display
	 * string. A user's OAuth-provided or self-registered display name can
	 * legally contain angle brackets; leaving those in place risks XSS in any
	 * client that dumps `authorName` straight into innerHTML (typical in admin
	 * dashboards). Stripping — rather than escaping — keeps the JSON payload
	 * plain text so client renderers do not need to un-escape entities.
	 *
	 * Only single-character classes are used here (per CodeQL rule
	 * `js/incomplete-multi-character-sanitization`): each match is one char,
	 * the replacement is one char (space) or empty, and neither can
	 * regenerate a member of the class — so the pattern cannot re-appear in
	 * the output. An input like `<sc<script>ript>` therefore comes out with
	 * every `<` / `>` removed and no `<script` substring left behind.
	 * @param { string } value The candidate display string
	 * @returns { string } Trimmed, tag-free, length-capped string
	 */
	private static sanitizeAuthorName(value: string): string {
		return value
			.replace(/[\r\n\t\0]+/g, ' ')
			.replace(/[<>]/g, '')
			.trim()
			.slice(0, MAX_AUTHOR_NAME_LENGTH);
	}

	/**
	 * @description Resolve the display name for a comment author from the JWT
	 * user. Never trusts a client-supplied `authorName` — the value always
	 * comes from the JWT identity so a comment cannot claim to be from
	 * someone else, and is passed through `sanitizeAuthorName` before storage.
	 * @param { JwtPayload } user The authenticated user
	 * @returns { string } Display name (falls back to email local part or "User")
	 */
	private static resolveAuthorName(user: JwtPayload): string {
		const primary = user.name?.trim() || user.email?.split("@")[0] || 'User';
		const sanitized = this.sanitizeAuthorName(primary);
		return sanitized || 'User';
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
	 * @description Create a new comment for an article. Uses the authenticated user's identity.
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @param { JwtPayload } user The authenticated user (from authGuard)
	 * @returns { Promise<Response> } The created comment
	 */
	static async create(request: Request, env: Env, articleId: string, user: JwtPayload): Promise<Response> {
		const body = await this.parseBody(request);
		if (!isObject(body)) return Res.badRequest("Invalid request body. Expected JSON.");

		const validContent = this.validateContent(body.content);
		if (!validContent) return Res.unprocessable(`content is required (max ${MAX_COMMENT_LENGTH} chars)`);

		const authorName = this.resolveAuthorName(user);
		const repo = new ArticleCommentRepository(env.DB);
		const comment = await new ArticleCommentService(repo).create(articleId, {
			authorName,
			content: validContent,
			userId: user.sub,
		});
		return Res.created(comment);
	}

	/**
	 * @description Update an existing comment. Enforces owner-or-admin and article_id match.
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID (from resolveArticle)
	 * @param { string } commentId The comment ID
	 * @param { JwtPayload } user The authenticated user (from authGuard)
	 * @returns { Promise<Response> } The updated comment
	 */
	static async update(request: Request, env: Env, articleId: string, commentId: string, user: JwtPayload): Promise<Response> {
		const numericId = this.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const body = await this.parseBody(request);
		if (!isObject(body)) return Res.badRequest("Invalid request body. Expected JSON.");

		const validContent = this.validateContent(body.content);
		if (!validContent) return Res.unprocessable(`content is required (max ${MAX_COMMENT_LENGTH} chars)`);

		const repo = new ArticleCommentRepository(env.DB);
		const service = new ArticleCommentService(repo);

		const existing = await service.findById(numericId);
		if (!existing) return Res.notFound();
		// Prevent cross-article ID probing
		if (existing.articleId !== articleId) return Res.notFound();
		// Ownership check: legacy comments (userId === null) are admin-only
		const isOwner = existing.userId !== null && existing.userId === user.sub;
		const isAdmin = user.role === "admin";
		if (!isOwner && !isAdmin) return Res.forbidden();

		const comment = await service.update(numericId, { content: validContent });
		if (!comment) return Res.notFound();
		return Res.ok(comment);
	}

	/**
	 * @description Delete a comment. Enforces owner-or-admin and article_id match.
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID (from resolveArticle)
	 * @param { string } commentId The comment ID
	 * @param { JwtPayload } user The authenticated user (from authGuard)
	 * @returns { Promise<Response> } No content response
	 */
	static async delete(request: Request, env: Env, articleId: string, commentId: string, user: JwtPayload): Promise<Response> {
		const numericId = this.validateCommentId(commentId);
		if (numericId === null) return Res.badRequest("Invalid comment id");

		const repo = new ArticleCommentRepository(env.DB);
		const service = new ArticleCommentService(repo);

		const existing = await service.findById(numericId);
		if (!existing) return Res.notFound();
		if (existing.articleId !== articleId) return Res.notFound();
		const isOwner = existing.userId !== null && existing.userId === user.sub;
		const isAdmin = user.role === "admin";
		if (!isOwner && !isAdmin) return Res.forbidden();

		const deleted = await service.delete(numericId);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}
}
