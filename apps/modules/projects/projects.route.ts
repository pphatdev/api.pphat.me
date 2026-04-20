import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { ProjectsController }       from './projects.controller';
import { ProjectDetailsController } from '../project-details/project-details.controller';
import { TagRepository }            from '../tags/tags.repo';
import { ListTagsByProject }        from '../tags/tags.service';
import { authGuard }                from '../../middlewares/auth.middleware';

type AppEnv = { Bindings: Env; Variables: { projectId: string } };

const app = new Hono<AppEnv>();

/** Resolve project by slug, store id in context, or 404. */
const resolveProject = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
	const project = await c.env.DB
		.prepare('SELECT id FROM projects WHERE slug = ?1')
		.bind(c.req.param('slug'))
		.first<{ id: string }>();
	if (!project) return c.json({ error: 'Not Found' }, 404);
	c.set('projectId', project.id);
	return next();
};

// Collection
app.get ('/v1/api/projects', (c) => ProjectsController.handle(c.req.raw, c.env));
app.post('/v1/api/projects', authGuard, (c) => ProjectsController.handle(c.req.raw, c.env));

// Project details — auth required for all methods
app.get   ('/v1/api/projects/:slug/details', authGuard, resolveProject, (c) => ProjectDetailsController.handle(c.req.raw, c.env, c.get('projectId')));
app.post  ('/v1/api/projects/:slug/details', authGuard, resolveProject, (c) => ProjectDetailsController.handle(c.req.raw, c.env, c.get('projectId')));
app.patch ('/v1/api/projects/:slug/details', authGuard, resolveProject, (c) => ProjectDetailsController.handle(c.req.raw, c.env, c.get('projectId')));
app.delete('/v1/api/projects/:slug/details', authGuard, resolveProject, (c) => ProjectDetailsController.handle(c.req.raw, c.env, c.get('projectId')));

// Tags by project (GET only)
app.get('/v1/api/projects/:slug/tags', resolveProject, async (c) => {
	const tags = await new ListTagsByProject(new TagRepository(c.env.DB)).execute(c.get('projectId'));
	return c.json(tags);
});

// Project detail (after sub-routes)
app.get   ('/v1/api/projects/:slug', (c) => ProjectsController.handle(c.req.raw, c.env, c.req.param('slug')));
app.put   ('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.handle(c.req.raw, c.env, c.req.param('slug')));
app.patch ('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.handle(c.req.raw, c.env, c.req.param('slug')));
app.delete('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.handle(c.req.raw, c.env, c.req.param('slug')));

export { app as projectRoutes };
