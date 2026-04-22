const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(data: unknown): string {
	return JSON.stringify(data);
}

export const Res = {
	ok: (data: unknown): Response => new Response(jsonBody(data), { status: 200, headers: JSON_HEADERS }),

	created: (data: unknown): Response => new Response(jsonBody(data), { status: 201, headers: JSON_HEADERS }),

	noContent: (): Response => new Response(null, { status: 204 }),

	badRequest: (message: string): Response => new Response(jsonBody({ error: message }), { status: 400, headers: JSON_HEADERS }),

	unauthorized: (message = "Unauthorized"): Response => new Response(jsonBody({ error: message }), { status: 401, headers: JSON_HEADERS }),

	forbidden: (message = "Forbidden"): Response => new Response(jsonBody({ error: message }), { status: 403, headers: JSON_HEADERS }),

	notFound: (message = "Not Found"): Response => new Response(jsonBody({ error: message }), { status: 404, headers: JSON_HEADERS }),

	conflict: (message: string): Response => new Response(jsonBody({ error: message }), { status: 409, headers: JSON_HEADERS }),

	unprocessable: (message: string): Response => new Response(jsonBody({ error: message }), { status: 422, headers: JSON_HEADERS }),

	internalError: (message = "Internal Server Error"): Response => new Response(jsonBody({ error: message }), { status: 500, headers: JSON_HEADERS }),
};
