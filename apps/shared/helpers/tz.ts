/**
 * Asia/Phnom_Penh is a fixed offset of UTC+07:00 (Indochina Time, no DST).
 * All wire timestamps for scheduling APIs are interpreted in this timezone
 * and stored internally as UTC (matching D1's `datetime('now')`).
 */
export const PHNOM_PENH_OFFSET_MINUTES = 7 * 60;
export const PHNOM_PENH_OFFSET_MS = PHNOM_PENH_OFFSET_MINUTES * 60 * 1000;
export const PHNOM_PENH_ISO_OFFSET = '+07:00';

/**
 * @description Parse an incoming scheduling timestamp and return a UTC ISO string suitable for D1.
 * Accepts:
 *  - Full ISO with offset (`2026-08-15T09:00:00+07:00`, `...Z`) — used as-is.
 *  - ISO without offset (`2026-08-15T09:00:00`) — treated as Asia/Phnom_Penh local.
 *  - Loose SQL-like `YYYY-MM-DD HH:mm[:ss]` — treated as Asia/Phnom_Penh local.
 * @param { string } input The user-supplied timestamp
 * @returns { string | null } UTC ISO string, or null if the input is not a valid date
 */
export function parsePhnomPenhToUtc(input: string): string | null {
    if (typeof input !== 'string' || input.trim().length === 0) return null;
    const trimmed = input.trim();

    // Full ISO with explicit offset — Date can parse directly.
    if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
        const d = new Date(trimmed);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Local Phnom_Penh: normalize `YYYY-MM-DD HH:mm[:ss]` to ISO and tack on +07:00.
    const local = trimmed.replace(' ', 'T');
    const withSeconds = /T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(withSeconds)) return null;
    const d = new Date(`${withSeconds}${PHNOM_PENH_ISO_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * @description Format a UTC ISO string as an Asia/Phnom_Penh ISO string with `+07:00` offset.
 * @param { string | null } utcIso The stored UTC timestamp
 * @returns { string | null } Formatted string, or null if input is null/invalid
 */
export function formatUtcAsPhnomPenh(utcIso: string | null): string | null {
    if (!utcIso) return null;
    const d = new Date(utcIso.includes('T') || utcIso.endsWith('Z') ? utcIso : `${utcIso.replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return null;
    const local = new Date(d.getTime() + PHNOM_PENH_OFFSET_MS);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}${PHNOM_PENH_ISO_OFFSET}`;
}

/**
 * @description Check whether a UTC ISO timestamp is strictly in the past.
 * @param { string } utcIso UTC ISO
 * @returns { boolean } True if past
 */
export function isPast(utcIso: string): boolean {
    const d = new Date(utcIso);
    return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}
