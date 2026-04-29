const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(data: unknown): string {
	return JSON.stringify(data);
}

export const badRequest = (message: string): Response => new Response(jsonBody({ error: message }), { status: 400, headers: JSON_HEADERS });
export const unauthorized = (message = "Unauthorized"): Response => new Response(jsonBody({ error: message }), { status: 401, headers: JSON_HEADERS });
export const forbidden = (message = "Forbidden"): Response => new Response(jsonBody({ error: message }), { status: 403, headers: JSON_HEADERS });
export const notFound = (message = "Not Found"): Response => new Response(jsonBody({ error: message }), { status: 404, headers: JSON_HEADERS });
export const conflict = (message: string): Response => new Response(jsonBody({ error: message }), { status: 409, headers: JSON_HEADERS });
export const unprocessable = (message: string): Response => new Response(jsonBody({ error: message }), { status: 422, headers: JSON_HEADERS });
export const internalError = (message = "Internal Server Error"): Response => new Response(jsonBody({ error: message }), { status: 500, headers: JSON_HEADERS });
