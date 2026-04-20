import { json } from "../../shared/helpers/json";
import { ArticleReactionRepository } from "./article-reactions.repo";
import { ArticleReactionService } from "./article-reactions.service";

const ALLOWED_TYPES = new Set(["like", "heart", "fire", "clap", "wow"]);

export class ArticleReactionsController {

	private static validateType(type: string): Response | null {
		if (!ALLOWED_TYPES.has(type)) {
			return json({ error: `Invalid reaction type. Allowed: ${[...ALLOWED_TYPES].join(", ")}` }, 422);
		}
		return null;
	}

	static async list(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleReactionRepository(env.DB);
		const reactions = await new ArticleReactionService(repo).list(articleId);
		return json(reactions);
	}

	static async create(request: Request, env: Env, articleId: string): Promise<Response> {
		const repo = new ArticleReactionRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
		const { type } = body as Record<string, unknown>;
		if (!type || typeof type !== "string") return json({ error: "type is required" }, 422);
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const reaction = await new ArticleReactionService(repo).increment(articleId, type);
		return json(reaction);
	}

	static async incrementByType(request: Request, env: Env, articleId: string, type: string): Promise<Response> {
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const repo = new ArticleReactionRepository(env.DB);
		const reaction = await new ArticleReactionService(repo).increment(articleId, type);
		return json(reaction);
	}

	static async decrementByType(request: Request, env: Env, articleId: string, type: string): Promise<Response> {
		const invalid = ArticleReactionsController.validateType(type);
		if (invalid) return invalid;
		const repo = new ArticleReactionRepository(env.DB);
		const reaction = await new ArticleReactionService(repo).decrement(articleId, type);
		return json({ type, removed: reaction === null, reaction });
	}
}
