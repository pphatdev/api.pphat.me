import { Res } from '../../shared/helpers/response';
import type { GeneratePayload, GenerateMode } from './ai.interface';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_TITLE_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 10000;
const ALLOWED_MODES: GenerateMode[] = ['description', 'content', 'both'];

/**
 * Normalizes the generation mode to a valid value
 */
function normalizeMode(value: unknown): GenerateMode {
	if (typeof value !== 'string') return 'both';
	return ALLOWED_MODES.includes(value as GenerateMode) ? (value as GenerateMode) : 'both';
}

/**
 * Builds the system prompt for the AI model
 */
function getSystemPrompt(mode: GenerateMode, language: string, tone: string): string {
	const rules = [
		'You are a professional content writing assistant.',
		`Output Language: ${language}`,
		`Tone: ${tone}`,
		'Output Format: MINIFIED JSON only.',
		'Constraints:',
	];

	if (mode === 'description' || mode === 'both') {
		rules.push('- description: A concise 1-2 sentence summary. Plain text only, no markdown.');
	}
	if (mode === 'content' || mode === 'both') {
		rules.push('- content: Practical, high-quality markdown content with sections. Use bullet points and bold text where appropriate.');
	}

	rules.push('- Do not include any introductory text or conversational filler.');
	rules.push('- Do not use markdown code blocks (fences) for the JSON itself.');

	return rules.join('\n');
}

/**
 * Builds the user prompt with provided data
 */
function getUserPrompt(payload: GeneratePayload): string {
	const parts = [`Title: ${payload.title.trim()}`];
	if (payload.context?.trim()) {
		parts.push(`Context: ${payload.context.trim()}`);
	}
	return parts.join('\n');
}

/**
 * Parses the AI output safely
 */
function parseOutput(result: any, mode: GenerateMode): { description?: string; content?: string } {
	const data = result?.response ?? result?.result ?? result;

	if (data && typeof data === 'object' && !Array.isArray(data)) {
		return {
			description: typeof data.description === 'string' ? data.description.trim() : undefined,
			content: typeof data.content === 'string' ? data.content.trim() : undefined,
		};
	}

	let rawText = (data || '').toString().trim();

	if (!rawText || rawText === '[object Object]') return {};
	if (rawText.includes('```')) {
		rawText = rawText.replace(/```(?:json)?/g, '').trim();
	}

	try {
		const parsed = JSON.parse(rawText);
		return {
			description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
			content: typeof parsed.content === 'string' ? parsed.content.trim() : undefined,
		};
	} catch (error) {
		// Fallback for non-JSON or partial responses
		if (mode === 'description') return { description: rawText };
		if (mode === 'content') return { content: rawText };
		return { description: rawText.substring(0, 250) + '...' };
	}
}

/**
 * Helper to get JSON schema based on mode
 */
function getJsonSchema(mode: GenerateMode) {
	const properties: any = {};
	const required: string[] = [];

	if (mode === 'description' || mode === 'both') {
		properties.description = {
			type: 'string',
			description: 'A concise summary of the topic (plain text only, no markdown)'
		};
		required.push('description');
	}

	if (mode === 'content' || mode === 'both') {
		properties.content = {
			type: 'string',
			description: 'Detailed markdown content'
		};
		required.push('content');
	}

	return {
		type: 'object',
		properties,
		required,
	};
}

export class AiController {
	/**
	 * Main generation endpoint
	 */
	static async generate(request: Request, env: Env): Promise<Response> {
		try {
			// Basic input validation
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== 'object') {
				return Res.badRequest('Invalid request body. Expected JSON.');
			}

			const payload = body as GeneratePayload;
			const title = payload.title?.trim() || '';
			const context = payload.context?.trim();
			const tone = payload.tone?.trim() || 'professional and clear';
			const language = payload.language?.trim() || 'English';
			const mode = normalizeMode(payload.mode);
			const model = payload.model?.trim() || DEFAULT_MODEL;

			// Logic constraints
			if (!title) return Res.unprocessable('title is required');
			if (title.length > MAX_TITLE_LENGTH) {
				return Res.unprocessable(`title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`);
			}
			if (context && context.length > MAX_CONTEXT_LENGTH) {
				return Res.unprocessable(`context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters`);
			}

			// Check AI binding
			if (!env.AI) {
				return Res.internalError('Workers AI binding "AI" is not configured');
			}

			// Prepare prompts
			const systemPrompt = getSystemPrompt(mode, language, tone);
			const userPrompt = getUserPrompt({ title, context });

			// Run AI with Optimized settings
			const response = await env.AI.run(model as any, {
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				],
				response_format: {
					type: 'json_schema',
					json_schema: getJsonSchema(mode),
				},
				// Dynamic token limit
				max_tokens: mode === 'description' ? 400 : mode === 'content' ? 1200 : 1800,
				temperature: 0.1, // Lower temperature for more reliable JSON structure
			});

			const data = parseOutput(response, mode);

			return Res.ok({
				model,
				mode,
				data: mode === 'description' ? data.description : (mode === 'content' ? data.content : data),
				usage: {
					tokens: (response as any).usage || 'unknown'
				}
			});

		} catch (error) {
			console.error('[AI_GENERATE_ERROR]', error);
			const message = error instanceof Error ? error.message : 'An unexpected error occurred during generation';
			return Res.internalError(message);
		}
	}
}
