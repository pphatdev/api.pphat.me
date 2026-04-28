export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface ChatPayload {
	message: string;
	history?: ChatMessage[];
	model?: string;
}

export interface ChatResponse {
	response: string;
	history: ChatMessage[];
}
