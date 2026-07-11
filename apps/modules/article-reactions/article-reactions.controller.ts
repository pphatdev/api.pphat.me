import { Res } from "../../shared/helpers/response";
import { ArticleReactionRepository } from "./article-reactions.repo";
import { ArticleReactionService } from "./article-reactions.service";

const ALLOWED_TYPES = new Set(["like", "heart", "fire", "clap", "wow"]);

export class ArticleReactionsController {

	/**
	 * @description Validates that the reaction type is allowed
	 * @param { string } type The reaction type to validate
	 * @returns { Response | null } Error response or null if valid
	 */
	private static validateType(type: string): Response | null {
		if (!ALLOWED_TYPES.has(type)) {
			return Res.unprocessable(`Invalid reaction type. Allowed: ${[...ALLOWED_TYPES].join(", ")}`);
		}
		return null;
	}

	/**
	 * @description List reactions for an article
	 * @method GET
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } List of reactions
	 */
	static async list(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleReactionRepository(env.DB);
		const reactions = await new ArticleReactionService(repo).list(articleId);
		return Res.ok(reactions);
	}

	/**
	 * @description Create (increment) a reaction for an article
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @returns { Promise<Response> } The updated reaction
	 */
	static async create(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleReactionRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");
		const { type } = body as Record<string, unknown>;
		if (!type || typeof type !== "string") return Res.unprocessable("type is required");
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const reaction = await new ArticleReactionService(repo).increment(articleId, type);
		return Res.ok(reaction);
	}

	/**
	 * @description Increment a specific reaction type
	 * @method PATCH
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<Response> } The updated reaction
	 */
	static async incrementByType(request: Request, env: Env, articleId: string, type: string): Promise<Response> {
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const repo = new ArticleReactionRepository(env.DB);
		const reaction = await new ArticleReactionService(repo).increment(articleId, type);
		return Res.ok(reaction);
	}

	/**
	 * @description Decrement a specific reaction type
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } articleId The article ID
	 * @param { string } type The reaction type
	 * @returns { Promise<Response> } The updated reaction or removal status
	 */
	static async decrementByType(request: Request, env: Env, articleId: string, type: string): Promise<Response> {
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const repo = new ArticleReactionRepository(env.DB);
		const reaction = await new ArticleReactionService(repo).decrement(articleId, type);
		return Res.ok({ type, removed: reaction === null, reaction });
	}
}
