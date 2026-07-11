import { Context } from 'hono';
import { Res } from './response';
import { isObject } from './json';

/**
 * @description Parses JSON body and validates it is an object
 * @param { Context } c The Hono context
 * @param { boolean } [silent=false] If true, return null instead of throwing
 * @returns { Promise<T | null> } The parsed body or null
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
 * @description Validates that all required keys are present in the object
 * @param { any } body The object to validate
 * @param { string[] } keys List of required keys
 * @returns { void }
 */
export function validateRequired(body: any, keys: string[]): void {
	const missing = keys.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
	if (missing.length > 0) {
		throw Res.unprocessable(`${missing.join(', ')} are required`);
	}
}
