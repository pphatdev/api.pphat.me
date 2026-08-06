import type { Context } from 'hono';
import { Res } from '../../shared/helpers/response';
import { isObject } from '../../shared/helpers/json';
import { DEFAULT_AI_MODEL, isAllowedAiModel } from '../../shared/config/ai';
import type { ChatPayload, ChatMessage } from './chat.interface';
import skillsData from './skills.json';

const HISTORY_MAX_LIMIT = 100;
const HISTORY_DEFAULT_LIMIT = 50;

// Ceilings for the *incoming* /chat payload — separate from the DB history
// cap. Anything above these would let a caller push a giant prompt through
// the AI binding on a single request and burn tokens.
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_TOTAL_CHARS = 20000;
const ALLOWED_HISTORY_ROLES = new Set<ChatMessage['role']>(['user', 'assistant']);

/**
 * @description Parse a positive integer query param clamped to [min, max]
 * @param { string | undefined } raw The raw query string value
 * @param { number } fallback Value to use when unset or invalid
 * @param { number } min Lower bound (inclusive)
 * @param { number } max Upper bound (inclusive)
 * @returns { number } Sanitised integer
 */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	const n = Number.parseInt(raw ?? '', 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

/**
 * @description Builds the system prompt for the Portfolio Chatbot
 * @returns { string } The formatted system prompt
 */
function getSystemPrompt(): string {
	const skills = skillsData.skills.map(s => {
		return `- ${s.name}: ${s.description}\n  Triggers: ${s.triggers.join(', ')}\n  Response guideline: ${s.response}`;
	}).join('\n\n');

	return `
You are the official Portfolio Chatbot for Sophat. Your goal is to provide accurate information about his portfolio, projects, skills, and contact details.

Context:
${skillsData.description}

Available Knowledge/Skills:
${skills}

Guidelines:
1. Be professional, friendly, and helpful.
2. If a user greets you, use the "Greeting" skill guideline.
3. If a user asks about projects, refer to the "Project Details" skill.
4. If a user asks for contact info, provide the details from "Contact Information".
5. Use markdown for formatting when appropriate (bold, lists).
6. If you don't know the answer, politely suggest they contact Sophat via the provided contact methods.
7. Keep responses concise but informative.
`.trim();
}

/**
 * @description Extracts AI response from the result
 * @param { any } response The raw AI result
 * @returns { string } Extracted text
 */
function getAiResponse(response: any): string {
	return response.response || response.result?.response || 'I am sorry, I could not process your request.';
}

/**
 * @description Prepares the message list for the AI model
 * @param { string } userMessage Current user message
 * @param { ChatMessage[] } history Chat history
 * @returns { ChatMessage[] } Full message list
 */
function prepareChatMessages(userMessage: string, history: ChatMessage[]): ChatMessage[] {
	return [
		{ role: 'system', content: getSystemPrompt() },
		...history,
		{ role: 'user', content: userMessage }
	];
}

/**
 * @description Validate the client-supplied `history` array so a caller cannot
 * push arbitrary system prompts or an unbounded transcript into the model.
 * @param { unknown } raw The `history` field from the request body
 * @returns { { history: ChatMessage[] } | { error: string } } Sanitised history or a validation error
 */
function validateHistory(raw: unknown): { history: ChatMessage[] } | { error: string } {
	if (raw === undefined || raw === null) return { history: [] };
	if (!Array.isArray(raw)) return { error: 'history must be an array' };
	if (raw.length > MAX_HISTORY_MESSAGES) {
		return { error: `history exceeds maximum length of ${MAX_HISTORY_MESSAGES} messages` };
	}

	const history: ChatMessage[] = [];
	let totalChars = 0;
	for (const entry of raw) {
		if (!isObject(entry)) return { error: 'each history entry must be an object' };
		const role = (entry as any).role;
		const content = (entry as any).content;
		if (!ALLOWED_HISTORY_ROLES.has(role)) {
			return { error: 'history role must be "user" or "assistant"' };
		}
		if (typeof content !== 'string' || content.length === 0) {
			return { error: 'history content must be a non-empty string' };
		}
		if (content.length > MAX_MESSAGE_CHARS) {
			return { error: `history message exceeds ${MAX_MESSAGE_CHARS} characters` };
		}
		totalChars += content.length;
		if (totalChars > MAX_HISTORY_TOTAL_CHARS) {
			return { error: `history exceeds ${MAX_HISTORY_TOTAL_CHARS} total characters` };
		}
		history.push({ role, content });
	}
	return { history };
}

/**
 * @description Saves chat history to the database
 * @param { D1Database | undefined } db Database binding
 * @param { string | undefined } userId User ID
 * @param { string } userMessage User's message
 * @param { string } aiResponse AI's response
 * @returns { Promise<void> }
 */
async function saveChatHistory(db: D1Database | undefined, userId: string | undefined, userMessage: string, aiResponse: string) {
	if (!userId || !db) return;
	try {
		await db.prepare(
			'INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?), (?, ?, ?)'
		).bind(
			userId, 'user', userMessage,
			userId, 'assistant', aiResponse
		).run();
	} catch (dbError) {
		console.error('[DB_SAVE_CHAT_ERROR]', dbError);
	}
}

export class ChatController {
	/**
	 * @description Main chat endpoint
	 * @method POST
	 * @param { Context } c The Hono context
	 * @returns { Promise<Response> } The AI chat response
	 */
	static async chat(c: Context): Promise<Response> {
		try {
			const env = c.env as Env;
			const body = await c.req.json().catch(() => null);
			if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

			const payload = body as ChatPayload;
			const userMessage = payload.message?.trim();
			if (!userMessage) return Res.unprocessable('message is required');
			if (userMessage.length > MAX_MESSAGE_CHARS) {
				return Res.unprocessable(`message exceeds ${MAX_MESSAGE_CHARS} characters`);
			}

			const rawModel = typeof payload.model === 'string' && payload.model.trim()
				? payload.model.trim()
				: DEFAULT_AI_MODEL;
			if (!isAllowedAiModel(rawModel)) {
				return Res.unprocessable(`model "${rawModel}" is not permitted`);
			}
			const model = rawModel;

			const historyResult = validateHistory(payload.history);
			if ('error' in historyResult) return Res.unprocessable(historyResult.error);
			const history = historyResult.history;

			// Validation must run before this infrastructure check so tests and
			// misconfigured deploys still surface 422s (not 500s) on bad input.
			if (!env.AI) return Res.internalError('Workers AI binding "AI" is not configured');

			const messages = prepareChatMessages(userMessage, history);
			const response: any = await env.AI.run(model as any, {
				messages,
				max_tokens: 1000,
				temperature: 0.7,
			});

			const aiResponse = getAiResponse(response);
			const user = c.get('user');
			await saveChatHistory(env.DB, user?.sub, userMessage, aiResponse);

			return Res.ok({
				response: aiResponse,
				history: [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: aiResponse }],
				model,
			});

		} catch (error) {
			// Log full error server-side; do NOT surface exception text to
			// clients — it can leak binding names, upstream URLs, or stack
			// frames on stubbed / misconfigured envs.
			console.error('[CHAT_ERROR]', error);
			return Res.internalError('Chat request failed');
		}
	}

	/**
	 * @description Retrieve chat history for the logged-in user
	 * @method GET
	 * @param { Context } c The Hono context
	 * @returns { Promise<Response> } The user's chat history
	 */
	static async getHistory(c: Context): Promise<Response> {
		try {
			const env = c.env as Env;
			const user = c.get('user');

			if (!user?.sub) {
				return Res.unauthorized('Authentication required to view chat history');
			}

			if (!env.DB) {
				return Res.internalError('Database binding "DB" is not configured');
			}

			const limit = clampInt(c.req.query('limit'), HISTORY_DEFAULT_LIMIT, 1, HISTORY_MAX_LIMIT);
			const offset = clampInt(c.req.query('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

			// Fetch newest-first for pagination, then reverse so the caller still
			// gets messages in ascending chronological order per page.
			const history = await env.DB.prepare(
				'SELECT role, content, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
			).bind(user.sub, limit, offset).all();

			return Res.ok({
				history: (history.results ?? []).reverse(),
				limit,
				offset,
			});

		} catch (error) {
			console.error('[GET_HISTORY_ERROR]', error);
			return Res.internalError('Failed to fetch chat history');
		}
	}
}
