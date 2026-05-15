const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonBody(data: unknown): string {
	return JSON.stringify(data);
}

/**
 * @description Create a 400 Bad Request response
 * @param { string } message Error message
 * @returns { Response } 400 Response
 */
export const badRequest = (message: string): Response => new Response(jsonBody({ error: message }), { status: 400, headers: JSON_HEADERS });

/**
 * @description Create a 401 Unauthorized response
 * @param { string } [message="Unauthorized"] Error message
 * @returns { Response } 401 Response
 */
export const unauthorized = (message = "Unauthorized"): Response => new Response(jsonBody({ error: message }), { status: 401, headers: JSON_HEADERS });

/**
 * @description Create a 403 Forbidden response
 * @param { string } [message="Forbidden"] Error message
 * @returns { Response } 403 Response
 */
export const forbidden = (message = "Forbidden"): Response => new Response(jsonBody({ error: message }), { status: 403, headers: JSON_HEADERS });

/**
 * @description Create a 404 Not Found response
 * @param { string } [message="Not Found"] Error message
 * @returns { Response } 404 Response
 */
export const notFound = (message = "Not Found"): Response => new Response(jsonBody({ error: message }), { status: 404, headers: JSON_HEADERS });

/**
 * @description Create a 409 Conflict response
 * @param { string } message Error message
 * @returns { Response } 409 Response
 */
export const conflict = (message: string): Response => new Response(jsonBody({ error: message }), { status: 409, headers: JSON_HEADERS });

/**
 * @description Create a 422 Unprocessable Entity response
 * @param { string } message Error message
 * @returns { Response } 422 Response
 */
export const unprocessable = (message: string): Response => new Response(jsonBody({ error: message }), { status: 422, headers: JSON_HEADERS });

/**
 * @description Create a 500 Internal Server Error response
 * @param { string } [message="Internal Server Error"] Error message
 * @returns { Response } 500 Response
 */
export const internalError = (message = "Internal Server Error"): Response => new Response(jsonBody({ error: message }), { status: 500, headers: JSON_HEADERS });
