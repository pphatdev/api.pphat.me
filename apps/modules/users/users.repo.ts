import type { IamUser, IamUserRow, IUserRepository, RoleChangeResult, UserListParams, UserRole } from "./users.interface";
import type { PaginatedResult } from "../../shared/interfaces";

const COLUMNS = 'id, name, email, avatar, provider, email_verified, role, created_at, updated_at';

const ALLOWED_SORT_MAP: Record<string, string> = {
	name: 'name',
	email: 'email',
	role: 'role',
	provider: 'provider',
	created_at: 'created_at',
	createdAt: 'created_at',
	updated_at: 'updated_at',
	updatedAt: 'updated_at',
};

export class UserRepository implements IUserRepository {
	constructor(private readonly db: D1Database) { }

	/**
	 * @description List users with search, role filter and pagination.
	 * Default order: admins first, then newest.
	 */
	async findAll(params: UserListParams): Promise<PaginatedResult<IamUser>> {
		const { page, limit, search, sort, order, role } = params;

		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		const chosen = sort?.[0] && ALLOWED_SORT_MAP[sort[0]];
		const orderBy = chosen
			? `${chosen} ${safeOrder}, id ASC`
			: `CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at DESC, id ASC`;

		const conditions: string[] = [];
		const bindings: unknown[] = [];
		let idx = 1;

		if (search) {
			const like = `%${search}%`;
			conditions.push(`(name LIKE ?${idx} OR email LIKE ?${idx + 1})`);
			bindings.push(like, like);
			idx += 2;
		}
		if (role) {
			conditions.push(`role = ?${idx++}`);
			bindings.push(role);
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).bind(...bindings);

		const dataStmt = limit === -1
			? this.db.prepare(`SELECT ${COLUMNS} FROM users ${where} ORDER BY ${orderBy}`).bind(...bindings)
			: this.db
				.prepare(`SELECT ${COLUMNS} FROM users ${where} ORDER BY ${orderBy} LIMIT ?${idx} OFFSET ?${idx + 1}`)
				.bind(...bindings, limit, (page - 1) * limit);

		const [dataResult, countRow] = await Promise.all([
			dataStmt.all<IamUserRow>(),
			countStmt.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;
		const effectiveLimit = limit === -1 ? total : limit;
		return {
			data: dataResult.results.map(mapRow),
			pagination: {
				page,
				limit,
				total,
				totalPages: effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0,
			},
		};
	}

	async findById(id: string): Promise<IamUser | null> {
		const row = await this.db
			.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?1`)
			.bind(id)
			.first<IamUserRow>();
		return row ? mapRow(row) : null;
	}

	/**
	 * @description Change a user's role in one atomic statement. The WHERE
	 * clause refuses to demote the last remaining admin, so two concurrent
	 * demotions cannot leave the system without an admin. The session
	 * invalidation floor is bumped so access tokens carrying the old role
	 * claim stop working; the next refresh re-reads the role from the DB.
	 */
	async updateRole(id: string, role: UserRole): Promise<RoleChangeResult> {
		const result = await this.db
			.prepare(
				`UPDATE users
				 SET role = ?1,
				     session_invalidated_at = CASE WHEN role = ?1 THEN session_invalidated_at ELSE datetime('now') END,
				     updated_at = CASE WHEN role = ?1 THEN updated_at ELSE datetime('now') END
				 WHERE id = ?2
				   AND NOT (
				       role = 'admin' AND ?1 <> 'admin'
				       AND (SELECT COUNT(*) FROM users WHERE role = 'admin') <= 1
				   )`,
			)
			.bind(role, id)
			.run();

		const user = await this.findById(id);
		if (!user) return { ok: false, reason: 'not_found' };
		if ((result.meta.changes ?? 0) === 0) return { ok: false, reason: 'last_admin' };
		return { ok: true, user };
	}
}

function mapRow(row: IamUserRow): IamUser {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		avatar: row.avatar,
		provider: row.provider,
		emailVerified: row.email_verified === 1,
		role: row.role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
