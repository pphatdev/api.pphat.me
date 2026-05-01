import { Context } from 'hono';
import { Res } from './response';
import { isObject } from './json';

/**
 * Parses JSON body and validates it's an object.
 * Returns null if invalid, and automatically sends Bad Request if silent is false.
 */
export async function getValidBody<T>(c: Context, silent = false): Promise<T | null> {
	const body = await c.req.json().catch(() => null);
	if (!isObject(body)) {
		if (!silent) throw Res.badRequest("Invalid request body. Expected JSON.");
		return null;
	}
	return body as T;
}

/**
 * Validates that all required keys are present in the object.
 * Throws Unprocessable Entity if any are missing.
 */
export function validateRequired(body: any, keys: string[]): void {
	const missing = keys.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
	if (missing.length > 0) {
		throw Res.unprocessable(`${missing.join(', ')} are required`);
	}
}
