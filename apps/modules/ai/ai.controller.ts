import { Res } from '../../shared/helpers/response';
import type { GeneratePayload, GenerateMode } from './ai.interface';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_TITLE_LENGTH = 180;
const MAX_CONTEXT_LENGTH = 8000;
const ALLOWED_MODES: GenerateMode[] = ['description', 'content', 'both'];

function normalizeMode(value: unknown): GenerateMode {
	if (typeof value !== 'string') return 'both';
	return ALLOWED_MODES.includes(value as GenerateMode) ? (value as GenerateMode) : 'both';
}

function buildPrompt(payload: GeneratePayload): string {
	const mode = payload.mode ?? 'both';
	const tone = payload.tone?.trim() || 'professional and clear';
	const language = payload.language?.trim() || 'English';
	const context = payload.context?.trim();

	const outputRules = mode === 'description'
		? 'Return a JSON object with key "description" only.'
		: mode === 'content'
			? 'Return a JSON object with key "content" only.'
			: 'Return a JSON object with keys "description" and "content".';

	const base = [
		'You are an API writing assistant.',
		`Write in ${language} with a ${tone} tone.`,
		'Description should be 1-2 concise sentences.',
		'Content should be practical markdown with short sections.',
		'Do not include markdown fences.',
		outputRules,
		`Title: ${payload.title.trim()}`,
	];

	if (context) {
		base.push(`Context: ${context}`);
	}

	return base.join('\n');
}

function parseOutput(result: unknown, mode: GenerateMode): { description?: string; content?: string } {
	const text = (
		typeof result === 'string'
			? result
			: (result as Record<string, unknown>)?.response ??
			(result as Record<string, unknown>)?.result ??
			''
	).toString();

	try {
		const parsed = JSON.parse(text) as { description?: string; content?: string };
		return {
			description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
			content: typeof parsed.content === 'string' ? parsed.content.trim() : undefined,
		};
	} catch {
		if (mode === 'description') return { description: text.trim() };
		if (mode === 'content') return { content: text.trim() };
		return { description: text.trim() };
	}
}

export class AiController {
	static async generate(request: Request, env: Env): Promise<Response> {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') return Res.badRequest('Invalid JSON body');

		const payload = body as Record<string, unknown>;
		const title = typeof payload.title === 'string' ? payload.title.trim() : '';
		const context = typeof payload.context === 'string' ? payload.context.trim() : undefined;
		const tone = typeof payload.tone === 'string' ? payload.tone.trim() : undefined;
		const language = typeof payload.language === 'string' ? payload.language.trim() : undefined;
		const mode = normalizeMode(payload.mode);

		if (!title) return Res.unprocessable('title is required');
		if (title.length > MAX_TITLE_LENGTH) return Res.unprocessable('title is too long (max 180 characters)');
		if (context && context.length > MAX_CONTEXT_LENGTH) return Res.unprocessable('context is too long (max 8000 characters)');

		if (!env.AI) {
			return Res.internalError('Workers AI binding "AI" is not configured');
		}

		try {
			const prompt = buildPrompt({ title, context, tone, language, mode });
			const model = typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : DEFAULT_MODEL;

			const output = await env.AI.run(model, {
				messages: [
					{ role: 'system', content: 'Return valid minified JSON only.' },
					{ role: 'user', content: prompt },
				],
				max_tokens: 900,
				temperature: 0.4,
			});

			const data = parseOutput(output, mode);
			return Res.ok({
				model,
				mode,
				data,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'AI generation failed';
			return Res.internalError(message);
		}
	}
}
