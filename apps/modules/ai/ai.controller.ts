import { Res } from '../../shared/helpers/response';
import { isObject } from '../../shared/helpers/json';
import type { GeneratePayload, GenerateMode } from './ai.interface';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_TITLE_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 10000;
const ALLOWED_MODES: GenerateMode[] = ['description', 'content', 'both'];


/**
 * @description Normalizes the generation mode to a valid value
 * @param { unknown } value The mode value to normalize
 * @returns { GenerateMode } A valid GenerateMode
 */
function normalizeMode(value: unknown): GenerateMode {
	if (typeof value !== 'string') return 'both';
	return ALLOWED_MODES.includes(value as GenerateMode) ? (value as GenerateMode) : 'both';
}

/**
 * @description Builds the system prompt for the AI model
 * @param { GenerateMode } mode The generation mode
 * @param { string } language Target language
 * @param { string } tone Desired tone
 * @returns { string } The formatted system prompt
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
 * @description Builds the user prompt with provided data
 * @param { GeneratePayload } payload The generation payload
 * @returns { string } The formatted user prompt
 */
function getUserPrompt(payload: GeneratePayload): string {
	const parts = [`Title: ${payload.title.trim()}`];
	if (payload.context?.trim()) {
		parts.push(`Context: ${payload.context.trim()}`);
	}
	return parts.join('\n');
}

/**
 * @description Handles fallback parsing for non-JSON or partial responses
 * @param { string } rawText The raw text from AI
 * @param { GenerateMode } mode The generation mode
 * @returns { { description?: string; content?: string } } Parsed or fallback content
 */
function handleParseFallback(rawText: string, mode: GenerateMode): { description?: string; content?: string } {
	if (mode === 'description') return { description: rawText };
	if (mode === 'content') return { content: rawText };
	return { description: rawText.substring(0, 250) + '...' };
}

/**
 * @description Extracts raw data from AI result
 * @param { any } result The raw AI result
 * @returns { any } Extracted data
 */
function extractData(result: any): any {
	return result?.response || result?.result || result;
}

/**
 * @description Normalizes a field value from AI output
 * @param { unknown } val The value to normalize
 * @returns { string | undefined } Trimmed string or undefined
 */
function normalizeField(val: unknown): string | undefined {
	if (typeof val !== 'string') return undefined;
	return val.trim() || undefined;
}

/**
 * @description Parses the AI output safely
 * @param { any } result The raw AI result
 * @param { GenerateMode } mode The generation mode
 * @returns { { description?: string; content?: string } } Parsed content
 */
function parseOutput(result: any, mode: GenerateMode): { description?: string; content?: string } {
	const data = extractData(result);

	if (isObject(data)) {
		return {
			description: normalizeField(data.description),
			content: normalizeField(data.content),
		};
	}

	const rawText = (data || '').toString().trim();
	if (!rawText || rawText === '[object Object]') return {};

	const cleaned = rawText.replace(/```(?:json)?/g, '').trim();

	try {
		const parsed = JSON.parse(cleaned);
		return {
			description: normalizeField(parsed.description),
			content: normalizeField(parsed.content),
		};
	} catch {
		return handleParseFallback(cleaned, mode);
	}
}

/**
 * @description Helper to get JSON schema based on mode
 * @param { GenerateMode } mode The generation mode
 * @returns { object } The JSON schema
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

/**
 * @description Validates the generation payload
 * @param { GeneratePayload } payload The payload to validate
 * @returns { Response | null } Error response or null if valid
 */
function validatePayload(payload: GeneratePayload): Response | null {
	const title = payload.title?.trim() || '';
	const context = payload.context?.trim();

	if (!title) return Res.unprocessable('title is required');
	if (title.length > MAX_TITLE_LENGTH) {
		return Res.unprocessable(`title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`);
	}
	if (context && context.length > MAX_CONTEXT_LENGTH) {
		return Res.unprocessable(`context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters`);
	}

	return null;
}

/**
 * @description Gets the max tokens based on mode
 * @param { GenerateMode } mode The generation mode
 * @returns { number } Maximum token count
 */
function getMaxTokens(mode: GenerateMode): number {
	if (mode === 'description') return 400;
	if (mode === 'content') return 1200;
	return 1800;
}

/**
 * @description Runs the AI generation using Cloudflare Workers AI
 * @param { Env } env Environment bindings
 * @param { string } model Model identifier
 * @param { GenerateMode } mode Generation mode
 * @param { any } body Request body
 * @returns { Promise<any> } AI result
 */
async function runAiGeneration(env: Env, model: string, mode: GenerateMode, body: any) {
	return env.AI.run(model as any, {
		messages: [
			{ role: 'system', content: getSystemPrompt(mode, body.language || 'English', body.tone || 'professional and clear') },
			{ role: 'user', content: getUserPrompt(body as any) },
		],
		response_format: { type: 'json_schema', json_schema: getJsonSchema(mode) },
		max_tokens: getMaxTokens(mode),
		temperature: 0.1,
	});
}

export class AiController {
	/**
	 * @description Main generation endpoint
	 * @method POST
	 * @param { Request } request The Hono request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } The AI generation response
	 */
	static async generate(request: Request, env: Env): Promise<Response> {
		try {
			const body = await request.json().catch(() => null);
			if (!isObject(body)) return Res.badRequest('Invalid request body. Expected JSON.');

			const error = validatePayload(body as GeneratePayload);
			if (error) return error;

			if (!env.AI) return Res.internalError('Workers AI binding "AI" is not configured');

			const mode = normalizeMode(body.mode);
			const model = (body.model || DEFAULT_MODEL).trim();

			const response: any = await runAiGeneration(env, model, mode, body);

			const data = parseOutput(response, mode);
			const result = mode === 'description' ? data.description : (mode === 'content' ? data.content : data);

			return Res.ok({
				model,
				mode,
				data: result,
				usage: { tokens: response.usage || 'unknown' }
			});
		} catch (error) {
			console.error('[AI_GENERATE_ERROR]', error);
			return Res.internalError(error instanceof Error ? error.message : 'An unexpected error occurred during generation');
		}
	}
}

