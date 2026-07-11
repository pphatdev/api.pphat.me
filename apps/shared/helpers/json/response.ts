/**
 * @description Create a JSON response
 * @param { unknown } data Response data
 * @param { number } [status=200] HTTP status code
 * @returns { Response } JSON Response
 */
export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
