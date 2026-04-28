import type { Context } from 'hono';
import { Res } from '../../shared/helpers/response';
import type { ChatPayload, ChatMessage } from './chat.interface';
import skillsData from './skills.json';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Builds the system prompt for the Portfolio Chatbot
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

export class ChatController {
	/**
	 * Main chat endpoint
	 */
	static async chat(c: Context): Promise<Response> {
		try {
			const env = c.env as Env;
			const user = c.get('user');
			const body = await c.req.json().catch(() => null);

			if (!body || typeof body !== 'object') {
				return Res.badRequest('Invalid request body. Expected JSON.');
			}

			const payload = body as ChatPayload;
			const userMessage = payload.message?.trim();
			const history = payload.history || [];
			const model = payload.model || DEFAULT_MODEL;

			if (!userMessage) {
				return Res.unprocessable('message is required');
			}

			if (!env.AI) {
				return Res.internalError('Workers AI binding "AI" is not configured');
			}

			const systemPrompt = getSystemPrompt();

			// Prepare messages for the AI
			const messages: ChatMessage[] = [
				{ role: 'system', content: systemPrompt },
				...history,
				{ role: 'user', content: userMessage }
			];

			// Run AI
			const response: any = await env.AI.run(model as any, {
				messages,
				max_tokens: 1000,
				temperature: 0.7,
			});

			const aiResponse = response.response || response.result?.response || 'I am sorry, I could not process your request.';

			// Construct new history for the response
			const newHistory: ChatMessage[] = [
				...history,
				{ role: 'user', content: userMessage },
				{ role: 'assistant', content: aiResponse }
			];

			// Optional: Save history to DB if user is logged in
			if (user?.sub && env.DB) {
				try {
					await env.DB.prepare(
						'INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?), (?, ?, ?)'
					).bind(
						user.sub, 'user', userMessage,
						user.sub, 'assistant', aiResponse
					).run();
				} catch (dbError) {
					console.error('[DB_SAVE_CHAT_ERROR]', dbError);
					// We don't fail the request if history saving fails
				}
			}

			return Res.ok({
				response: aiResponse,
				history: newHistory,
				model
			});

		} catch (error) {
			console.error('[CHAT_ERROR]', error);
			const message = error instanceof Error ? error.message : 'An unexpected error occurred during chat';
			return Res.internalError(message);
		}
	}

	/**
	 * Retrieve chat history for the logged-in user
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
