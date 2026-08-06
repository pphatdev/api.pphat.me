import { Hono } from 'hono';
import { DashboardController } from './dashboard.controller';
import { authGuard, sseAuthGuard } from '../../middlewares/auth.middleware';

const dashboardRoutes = new Hono<{ Bindings: Env }>();

// Dashboard data should probably be protected and only for admins
dashboardRoutes.get('/v1/api/dashboard', authGuard, async (c, next) => {
    const user = c.get('user' as any);
    if (user?.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
}, DashboardController.getInitData);

// EventSource cannot set headers, so this route (and only this route) accepts
// the JWT via ?token=. Never widen sseAuthGuard to non-streaming endpoints.
dashboardRoutes.get('/v1/api/dashboard/live-traffic', sseAuthGuard, async (c, next) => {
    const user = c.get('user' as any);
    if (user?.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
}, DashboardController.streamLiveTraffic);

export { dashboardRoutes };
