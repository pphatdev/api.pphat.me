/**
 * Lightweight helpers for test fetch calls.
 * Reduces boilerplate in spec files.
 */

export interface FetchResult<T = Record<string, unknown>> {
	status: number;
	body: T;
}

type FetchWorker = { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> };

export async function fetchJson<T = Record<string, unknown>>(
	worker: FetchWorker,
	url: string,
	init?: RequestInit,
): Promise<FetchResult<T>> {
	const res = await worker.fetch(url, init);
	const body = await res.json() as T;
	return { status: res.status, body };
}

export function get<T = Record<string, unknown>>(
	worker: FetchWorker,
	url: string,
	headers?: Record<string, string>,
): Promise<FetchResult<T>> {
	return fetchJson<T>(worker, url, headers ? { headers } : undefined);
}

export function post<T = Record<string, unknown>>(
	worker: FetchWorker,
	url: string,
	payload: unknown,
	headers: Record<string, string> = { "Content-Type": "application/json" },
): Promise<FetchResult<T>> {
	return fetchJson<T>(worker, url, {
		method: "POST",
		headers,
		body: JSON.stringify(payload),
	});
}

export function patch<T = Record<string, unknown>>(
	worker: FetchWorker,
	url: string,
	payload: unknown,
	headers: Record<string, string> = { "Content-Type": "application/json" },
): Promise<FetchResult<T>> {
	return fetchJson<T>(worker, url, {
		method: "PATCH",
		headers,
		body: JSON.stringify(payload),
	});
}

export async function del(
	worker: FetchWorker,
	url: string,
	headers?: Record<string, string>,
): Promise<{ status: number }> {
	const res = await worker.fetch(url, { method: "DELETE", headers });
	return { status: res.status };
}
