/**
 * Helper to get the next slug based on creation date.
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
 * Helper to get the previous slug based on creation date.
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
 * Builds dynamic update fields and values for D1 queries.
 */
export function buildUpdateFields<T>(dto: T, mappings: [keyof T, string, ((v: any) => any)?][], startIdx = 1): { fields: string[], values: unknown[], nextIdx: number } {
	const fields: string[] = [];
	const values: unknown[] = [];
	let idx = startIdx;

	for (const [key, field, transform] of mappings) {
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
 * Builds standard WHERE conditions and bindings for search/published filters.
 */
export function buildListConditions(search?: string, onlyPublished?: boolean, startIdx = 1): { conditions: string[], bindings: unknown[], nextIdx: number } {
	const conditions: string[] = ['1=1'];
	const bindings: unknown[] = [];
	let idx = startIdx;

	if (onlyPublished) {
		conditions.push('published = 1');
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
 * Common summary stats for collections (total, published, draft).
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
 * Maps database author rows to the Author interface.
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
