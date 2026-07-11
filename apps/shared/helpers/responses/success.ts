const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(data: unknown): string {
	return JSON.stringify(data);
}

/**
 * @description Create a 200 OK response
 * @param { unknown } data Response data
 * @returns { Response } 200 Response
 */
export const ok = (data: unknown): Response => new Response(jsonBody(data), { status: 200, headers: JSON_HEADERS });

/**
 * @description Create a 201 Created response
 * @param { unknown } data Response data
 * @returns { Response } 201 Response
 */
export const created = (data: unknown): Response => new Response(jsonBody(data), { status: 201, headers: JSON_HEADERS });

/**
 * @description Create a 204 No Content response
 * @returns { Response } 204 Response
 */
export const noContent = (): Response => new Response(null, { status: 204 });
