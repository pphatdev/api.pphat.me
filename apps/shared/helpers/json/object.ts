/**
 * Checks if a value is a plain object
 */
export function isObject(val: unknown): val is Record<string, any> {
	return !!val && typeof val === 'object' && !Array.isArray(val);
}
