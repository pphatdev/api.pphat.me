import type { PaginatedResult } from "../../shared/interfaces";
import type { ListOptions } from "../../shared/helpers/query";

/** Roles permitted by the `users.role` CHECK constraint (migration 0010). */
export const USER_ROLES = ['user', 'admin', 'contributor', 'author'] as const;
export type UserRole = typeof USER_ROLES[number];

export function isUserRole(value: unknown): value is UserRole {
	return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** IAM view of a user. Never includes password hash or provider id. */
export interface IamUser {
	id: string;
	name: string | null;
	email: string | null;
	avatar: string | null;
	provider: 'github' | 'google' | 'email';
	emailVerified: boolean;
	role: UserRole;
	createdAt: string;
	updatedAt: string;
}

export interface IamUserRow {
	id: string;
	name: string | null;
	email: string | null;
	avatar: string | null;
	provider: 'github' | 'google' | 'email';
	email_verified: number;
	role: UserRole;
	created_at: string;
	updated_at: string;
}

export interface UserListParams extends Pick<ListOptions, 'page' | 'limit' | 'search' | 'sort' | 'order'> {
	role?: UserRole;
}

/** Outcome of a role change, so the controller can map it to an HTTP status. */
export type RoleChangeResult =
	| { ok: true; user: IamUser }
	| { ok: false; reason: 'not_found' | 'last_admin' };

export interface IUserRepository {
	findAll(params: UserListParams): Promise<PaginatedResult<IamUser>>;
	findById(id: string): Promise<IamUser | null>;
	updateRole(id: string, role: UserRole): Promise<RoleChangeResult>;
}

export type AppEnv = {
	Bindings: Env;
	Variables: {
		user?: import('../auth/auth.interface').JwtPayload;
	};
};
