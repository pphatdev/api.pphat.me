export type GenerateMode = 'description' | 'content' | 'both';

export interface GeneratePayload {
	title: string;
	context?: string;
	tone?: string;
	language?: string;
	mode?: GenerateMode;
}
