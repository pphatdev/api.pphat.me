/**
 * @description Checks if a value is a plain object
 * @param { unknown } val The value to check
 * @returns { boolean } True if the value is a plain object
 */
export function isObject(val: unknown): val is Record<string, any> {
	return !!val && typeof val === 'object' && !Array.isArray(val);
}
