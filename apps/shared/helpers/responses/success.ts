const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(data: unknown): string {
	return JSON.stringify(data);
}

export const ok = (data: unknown): Response => new Response(jsonBody(data), { status: 200, headers: JSON_HEADERS });
export const created = (data: unknown): Response => new Response(jsonBody(data), { status: 201, headers: JSON_HEADERS });
export const noContent = (): Response => new Response(null, { status: 204 });
