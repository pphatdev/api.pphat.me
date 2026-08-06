/**
 * Allow-listed Workers AI text-generation models. Only models on this list
 * may be invoked via `/v1/api/ai/generate` or `/v1/api/chat`. This exists to
 * cap billing exposure: without it, any authenticated client could pick the
 * largest model in the Workers AI catalog on every request.
 *
 * When adding a model here, verify: (1) text-generation only, (2) latency
 * profile is acceptable for the endpoint's SLA, (3) per-neuron cost is
 * within the current billing budget.
 */
const ALLOWED_AI_MODELS = [
	'@cf/meta/llama-3.1-8b-instruct',
	'@cf/meta/llama-3.2-3b-instruct',
	'@cf/meta/llama-3.2-1b-instruct',
] as const;

export type AllowedAiModel = (typeof ALLOWED_AI_MODELS)[number];

export const DEFAULT_AI_MODEL: AllowedAiModel = '@cf/meta/llama-3.1-8b-instruct';

/**
 * @description Type-narrowing allow-list check for AI model IDs.
 * @param { unknown } value Candidate model ID from client input
 * @returns { value is AllowedAiModel } True when the value is on the allow-list
 */
export function isAllowedAiModel(value: unknown): value is AllowedAiModel {
	return typeof value === 'string' && (ALLOWED_AI_MODELS as readonly string[]).includes(value);
}
