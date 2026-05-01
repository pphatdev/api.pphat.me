import { Hono } from 'hono';
import { ProjectsController } from './projects.controller';
import { ProjectDetailsController } from '../project-details/project-details.controller';
import { authGuard } from '../../middlewares/auth.middleware';
import { AppEnv } from './projects.interface';

const app = new Hono<AppEnv>();

/**
 * @description Get Project List
 * @method GET
 * ---------------------------------------
 * @param { Number } page - The page number for pagination
 * @param { Number } limit - The number of items per page
 * @param { String } search - The search query
 * @param { String } sort - The field to sort by
 * @param { String } order - The sort order (asc or desc)
*/
app.get('/v1/api/projects', (c) => ProjectsController.list(c.req.raw, c.env));

/**
 * @description Create Project
 * @method POST
 * ---------------------------------------
 * @param { String } title - The title of the project
 * @param { String } slug - The slug of the project
 * @param { String } description - The description of the project
 * @param { String } content - The content of the project
 * @param { String } thumbnail - The thumbnail of the project
 * @param { Boolean } published - The published status of the project
 * @param { Array<Number> } [tag_ids] - The IDs of the tags associated with the project
 * @param { Array<Number> } [contributor_ids] - The IDs of the contributors associated with the project
 * @param { Array<Number> } [languages] - The IDs of the languages associated with the project
 * @param { String } [demoUrl] - The URL of the project demo
 * @param { String } [repoUrl] - The URL of the project repository
 * @param { Array<String> } [techStack] - The technologies used in the project
 * @param { String } [status] - The status of the project (e.g., in-progress, completed)
*/
app.post('/v1/api/projects', authGuard, (c) => ProjectsController.create(c.req.raw, c.env));

/**
 * @description Get Project Details
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the project
*/
app.get('/v1/api/projects/:slug/details', ProjectsController.resolveProject, (c) => ProjectDetailsController.get(c.req.raw, c.env, c.get('projectId')));

/**
 * @description Get Project Tags
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the project
*/
app.get('/v1/api/projects/:slug/tags', ProjectsController.resolveProject, (c) => ProjectsController.getTagProject(c));

/**
 * @description Get Project By Slug
 * @method GET
 * ---------------------------------------
 * @param { String } slug - The slug of the project
*/
app.get('/v1/api/projects/:slug', (c) => ProjectsController.getBySlug(c));

/**
 * @description Update Project
 * @method PUT, PATCH
 * ---------------------------------------
 * @param { String } slug - The slug of the project
 * @param { String } title - The title of the project
 * @param { String } description - The description of the project
 * @param { Boolean } published - The published status of the project
 * @param { Array<Number> } [tag_ids] - The IDs of the tags associated with the project
 * @param { Array<Number> } [contributor_ids] - The IDs of the contributors associated with the project
 * @param { Array<Number> } [languages] - The IDs of the languages associated with the project
 * @param { String } [content] - The content of the project
 * @param { String } [demoUrl] - The URL of the project demo
 * @param { String } [repoUrl] - The URL of the project repository
 * @param { Array<String> } [techStack] - The technologies used in the project
 * @param { String } [status] - The status of the project (e.g., in-progress, completed)
*/
app.put('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.update(c.req.raw, c.env, c.req.param('slug')!));
app.patch('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.update(c.req.raw, c.env, c.req.param('slug')!));

/**
 * @description Delete Project
 * @method DELETE
 * ---------------------------------------
 * @param { String } slug - The slug of the project
*/
app.delete('/v1/api/projects/:slug', authGuard, (c) => ProjectsController.delete(c.req.raw, c.env, c.req.param('slug')!));

export { app as projectRoutes };
