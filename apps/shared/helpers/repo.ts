/**
 * @description Helper to get the next slug based on creation date
 * @param { D1Database } db Database binding
 * @param { string } tableName The table to search in
 * @param { string } currentSlug The slug of the current record
 * @returns { Promise<string | null> } The next slug or null
 */
export async function getNextSlug(db: D1Database, tableName: string, currentSlug: string): Promise<string | null> {
	const row = await db
		.prepare(`SELECT created_at FROM ${tableName} WHERE slug = ?1`)
		.bind(currentSlug)
		.first<{ created_at: string }>();

	if (!row) return null;

	const result = await db
		.prepare(`SELECT slug FROM ${tableName} WHERE created_at > ?1 ORDER BY created_at ASC LIMIT 1`)
		.bind(row.created_at)
		.first<{ slug: string }>();

	return result?.slug ?? null;
}

/**
 * @description Helper to get the previous slug based on creation date
 * @param { D1Database } db Database binding
 * @param { string } tableName The table to search in
 * @param { string } currentSlug The slug of the current record
 * @returns { Promise<string | null> } The previous slug or null
 */
export async function getPrevSlug(db: D1Database, tableName: string, currentSlug: string): Promise<string | null> {
	const row = await db
		.prepare(`SELECT created_at FROM ${tableName} WHERE slug = ?1`)
		.bind(currentSlug)
		.first<{ created_at: string }>();

	if (!row) return null;

	const result = await db
		.prepare(`SELECT slug FROM ${tableName} WHERE created_at < ?1 ORDER BY created_at DESC LIMIT 1`)
		.bind(row.created_at)
		.first<{ slug: string }>();

	return result?.slug ?? null;
}

/**
 * SQL identifier pattern. DB column names go straight into an UPDATE SET
 * clause so they cannot be user-controlled — this regex is a defense-in-depth
 * check against a mapping array that got constructed from untrusted input.
 * (No caller does that today; this is a tripwire for a future refactor.)
 */
const SQL_IDENT_RE = /^[a-z_][a-z0-9_]*$/;

/**
 * @description Build a parameterised UPDATE SET clause from a DTO + a
 * caller-supplied mappings table. The mappings array IS the allow-list of
 * writable fields for this table — callers must hard-code it, never build
 * it from a request body. Any mapping whose DB field name is not a
 * SQL-safe identifier is rejected at runtime with a thrown Error so the
 * mistake is loud rather than a query that binds the value into a
 * malformed SET clause.
 *
 * Undefined DTO values are skipped (so a partial PATCH works). Optional
 * transforms let a caller coerce booleans → 0/1 for D1's integer storage.
 *
 * @param { T } dto The DTO to project
 * @param { [keyof T, string, ((v: any) => any)?][] } mappings Field allow-list
 * @param { number } [startIdx=1] Starting placeholder index
 * @returns { { fields: string[]; values: unknown[]; nextIdx: number } }
 */
export function buildUpdateFields<T>(
	dto: T,
	mappings: [keyof T, string, ((v: any) => any)?][],
	startIdx = 1,
): { fields: string[]; values: unknown[]; nextIdx: number } {
	const fields: string[] = [];
	const values: unknown[] = [];
	let idx = startIdx;

	for (const [key, field, transform] of mappings) {
		if (!SQL_IDENT_RE.test(field)) {
			throw new Error(`buildUpdateFields: unsafe DB column name "${field}"`);
		}
		if (dto[key] !== undefined) {
			const val = transform ? transform(dto[key]) : dto[key];
			if (val !== undefined) {
				fields.push(`${field} = ?${idx++}`);
				values.push(val);
			}
		}
	}
	return { fields, values, nextIdx: idx };
}

/**
 * @description Builds standard WHERE conditions and bindings for search/published filters
 * @param { string } [search] Search term
 * @param { boolean } [onlyPublished] Whether to filter by published status
 * @param { number } [startIdx=1] Starting bind parameter index
 * @param { object } [opts] Extra filters
 * @param { boolean } [opts.onlyPublic] When true, additionally require `is_public = 1`
 * @returns { object } Object with conditions array, bindings array, and nextIdx
 */
export function buildListConditions(
	search?: string,
	onlyPublished?: boolean,
	startIdx = 1,
	opts?: { onlyPublic?: boolean },
): { conditions: string[], bindings: unknown[], nextIdx: number } {
	const conditions: string[] = ['1=1'];
	const bindings: unknown[] = [];
	let idx = startIdx;

	if (onlyPublished) {
		conditions.push('published = 1');
	}

	if (opts?.onlyPublic) {
		// An article is publicly visible if either the cron already flipped is_public,
		// or the scheduled publish_at has elapsed (so we surface it immediately even
		// before the next cron tick). The Cloudflare cron reconciles the flag over time.
		conditions.push("(is_public = 1 OR (publish_at IS NOT NULL AND datetime(publish_at) <= datetime('now')))");
	}

	if (search) {
		const like = `%${search}%`;
		conditions.push(`(title LIKE ?${idx} OR slug LIKE ?${idx + 1} OR description LIKE ?${idx + 2})`);
		bindings.push(like, like, like);
		idx += 3;
	}

	return { conditions, bindings, nextIdx: idx };
}

/**
 * @description Common summary stats for collections (total, published, draft)
 * @param { D1Database } db Database binding
 * @param { string } tableName The table to count
 * @returns { Promise<{ total: number; published: number; draft: number }> }
 */
export async function getStatsSummary(db: D1Database, tableName: string): Promise<{ total: number; published: number; draft: number }> {
	const row = await db
		.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) as published,
				SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) as draft
			FROM ${tableName}
		`)
		.first<{ total: number; published: number; draft: number }>();

	return {
		total: row?.total ?? 0,
		published: row?.published ?? 0,
		draft: row?.draft ?? 0
	};
}

/**
 * @description Maps database author rows to the Author interface
 * @param { any } a The raw database row
 * @returns { any } The mapped author object
 */
export function mapAuthorRow(a: any): any {
	return {
		id: a.id,
		name: a.name,
		profile: a.profile,
		url: a.url,
		bio: a.bio || "",
		avatarUrl: a.avatar_url || "",
		socialLinks: JSON.parse(a.social_links || "[]"),
		status: a.status || 0,
		createdAt: a.created_at || "",
		updatedAt: a.updated_at || "",
	};
}
