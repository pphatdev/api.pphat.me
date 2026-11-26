import { Hono } from 'hono';
import { UsersController } from './users.controller';
import { authGuard, requireAdmin } from '../../middlewares/auth.middleware';
import type { AppEnv } from './users.interface';

const app = new Hono<AppEnv>();

/**
 * @description List users (IAM, admin-only)
 * @method GET
 * ---------------------------------------
 * @param { Number } page
 * @param { Number } limit (-1 for all)
 * @param { String } search - Match against name, email
 * @param { String } role - Filter by role (user, admin, contributor, author)
 * @param { String } sort - name, email, role, provider, created_at, updated_at
 * @param { String } order - asc | desc
 */
app.get('/v1/api/users', authGuard, requireAdmin, (c) => UsersController.list(c.req.raw, c.env));

/**
 * @description Get a user (IAM, admin-only)
 * @method GET
 */
app.get('/v1/api/users/:id', authGuard, requireAdmin, (c) => UsersController.get(c.req.raw, c.env, c.req.param('id')!));

/**
 * @description Change a user's role (IAM, admin-only).
 * Cannot target yourself; cannot demote the last admin. The target's existing
 * access tokens are invalidated so the new role applies on next refresh.
 * @method PATCH
 * ---------------------------------------
 * @param { String } role - user | admin | contributor | author
 */
app.patch('/v1/api/users/:id/role', authGuard, requireAdmin, (c) => {
	const actor = c.get('user')!;
	return UsersController.updateRole(c.req.raw, c.env, c.req.param('id')!, actor.sub);
});

export { app as userRoutes };
