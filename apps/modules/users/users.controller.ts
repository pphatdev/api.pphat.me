import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { UserRepository } from "./users.repo";
import { UserService } from "./users.service";
import { USER_ROLES, isUserRole } from "./users.interface";

export class UsersController {

	/**
	 * @description Admin: list users for IAM management.
	 */
	static async list(request: Request, env: Env): Promise<Response> {
		const { page, limit, search, sort, order } = parseListParams(request.url);
		const roleParam = new URL(request.url).searchParams.get('role')?.trim() || undefined;
		if (roleParam !== undefined && !isUserRole(roleParam)) {
			return Res.unprocessable(`role must be one of: ${USER_ROLES.join(', ')}`);
		}

		const result = await new UserService(new UserRepository(env.DB)).list({
			page,
			limit,
			search,
			sort,
			order,
			role: roleParam,
		});
		return Res.ok(result);
	}

	/**
	 * @description Admin: get a single user.
	 */
	static async get(_request: Request, env: Env, id: string): Promise<Response> {
		const user = await new UserService(new UserRepository(env.DB)).getById(id);
		if (!user) return Res.notFound("User not found");
		return Res.ok(user);
	}

	/**
	 * @description Admin: change a user's role. Admins cannot change their own
	 * role (prevents accidental self-lockout), and the last admin cannot be
	 * demoted.
	 */
	static async updateRole(request: Request, env: Env, id: string, actorId: string): Promise<Response> {
		const body = await request.json().catch(() => null) as { role?: unknown } | null;
		if (!body || typeof body !== 'object') return Res.badRequest("Invalid JSON body");
		if (!isUserRole(body.role)) {
			return Res.unprocessable(`role must be one of: ${USER_ROLES.join(', ')}`);
		}
		if (id === actorId) return Res.forbidden("You cannot change your own role");

		const result = await new UserService(new UserRepository(env.DB)).updateRole(id, body.role);
		if (result.ok) return Res.ok(result.user);
		if (result.reason === 'not_found') return Res.notFound("User not found");
		return Res.conflict("Cannot demote the last admin");
	}
}
