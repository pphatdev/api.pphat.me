import { json } from "../../shared/helpers/json";
import { ArticleReactionRepository } from "./article-reactions.repo";
import {
	DeleteArticleReaction,
	DecrementArticleReaction,
	IncrementArticleReaction,
	ListArticleReactions,
} from "./article-reactions.service";

const ALLOWED_TYPES = new Set(["like", "heart", "fire", "clap", "wow"]);

export class ArticleReactionsController {
	static async handle(request: Request, env: Env, articleId: string, type?: string): Promise<Response> {
		const repo = new ArticleReactionRepository(env.DB);
		const method = request.method;

		// Detail: /v1/api/articles/:slug/reactions/:type
		if (type) {
			if (!ALLOWED_TYPES.has(type)) {
				return json({ error: `Invalid reaction type. Allowed: ${[...ALLOWED_TYPES].join(", ")}` }, 422);
			}

			if (method === "POST") {
				const reaction = await new IncrementArticleReaction(repo).execute(articleId, type);
				return json(reaction);
			}

			if (method === "DELETE") {
				const reaction = await new DecrementArticleReaction(repo).execute(articleId, type);
				return json({ type, removed: reaction === null, reaction });
			}

			return json({ error: "Method Not Allowed" }, 405);
		}

		// Collection: /v1/api/articles/:slug/reactions
		if (method === "GET") {
			const reactions = await new ListArticleReactions(repo).execute(articleId);
			return json(reactions);
		}

		if (method === "POST") {
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
			const { type: bodyType } = body as Record<string, unknown>;
			if (!bodyType || typeof bodyType !== "string") return json({ error: "type is required" }, 422);
			if (!ALLOWED_TYPES.has(bodyType)) {
				return json({ error: `Invalid reaction type. Allowed: ${[...ALLOWED_TYPES].join(", ")}` }, 422);
			}
			const reaction = await new IncrementArticleReaction(repo).execute(articleId, bodyType);
			return json(reaction);
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
