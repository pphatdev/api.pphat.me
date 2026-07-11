import type { Context } from 'hono';
import { Res } from '../../shared/helpers/response';
import { isObject } from '../../shared/helpers/json';
import type { ChatPayload, ChatMessage } from './chat.interface';
import skillsData from './skills.json';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

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

			if (!env.AI) return Res.internalError('Workers AI binding "AI" is not configured');

			const messages = prepareChatMessages(userMessage, payload.history || []);
			const response: any = await env.AI.run((payload.model || DEFAULT_MODEL) as any, {
				messages,
				max_tokens: 1000,
				temperature: 0.7,
			});

			const aiResponse = getAiResponse(response);
			const user = c.get('user');
			await saveChatHistory(env.DB, user?.sub, userMessage, aiResponse);

			const history = payload.history || [];
			return Res.ok({
				response: aiResponse,
				history: [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: aiResponse }],
				model: payload.model || DEFAULT_MODEL
			});

		} catch (error) {
			console.error('[CHAT_ERROR]', error);
			const message = error instanceof Error ? error.message : 'An unexpected error occurred during chat';
			return Res.internalError(message);
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

			const history = await env.DB.prepare(
				'SELECT role, content, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at ASC'
			).bind(user.sub).all();

			return Res.ok({
				history: history.results
			});

		} catch (error) {
			console.error('[GET_HISTORY_ERROR]', error);
			const message = error instanceof Error ? error.message : 'An unexpected error occurred while fetching history';
			return Res.internalError(message);
		}
	}
}
