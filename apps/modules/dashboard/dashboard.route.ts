import { Hono } from 'hono';
import { DashboardController } from './dashboard.controller';
import { authGuard } from '../../middlewares/auth.middleware';

const dashboardRoutes = new Hono<{ Bindings: Env }>();

// Dashboard data should probably be protected and only for admins
dashboardRoutes.get('/v1/api/dashboard', authGuard, async (c, next) => {
    const user = c.get('user' as any);
    if (user?.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
}, DashboardController.getInitData);

dashboardRoutes.get('/v1/api/dashboard/live-traffic', authGuard, async (c, next) => {
    const user = c.get('user' as any);
    if (user?.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
}, DashboardController.streamLiveTraffic);

export { dashboardRoutes };
