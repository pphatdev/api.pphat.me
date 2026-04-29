import type { Context, Next } from 'hono';
import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { AppEnv } from "./projects.interface";
import { ProjectRepository } from "./projects.repo";
import { TagService } from "../tags/tags.service";
import { TagRepository } from "../tags/tags.repo";
import { ProjectService } from "./projects.service";

export class ProjectsController {

	static resolveProject = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const project = await c.env.DB
			.prepare('SELECT id FROM projects WHERE slug = ?1')
			.bind(c.req.param('slug'))
			.first<{ id: string }>();
		if (!project) return c.json({ error: 'Not Found' }, 404);
		c.set('projectId', project.id);
		return next();
	};

	static async list(request: Request, env: Env): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const options = parseListParams(request.url);
		const result = await new ProjectService(repository).list(options, true);
		return Res.ok(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const { title, slug, description } = body as Record<string, unknown>;
		if (!title || !slug || !description) {
			return Res.unprocessable("title, slug and description are required");
		}

		try {
			const project = await new ProjectService(repository).create(body as never);
			return Res.created(project);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
				return Res.conflict("A project with this slug already exists");
			}
			throw err;
		}
	}

	static async getBySlug(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const project = await new ProjectService(repository).getBySlug(slug);
		if (!project) return Res.notFound();

		const [nextSlug, prevSlug] = await Promise.all([
			repository.getNextSlug(slug),
			repository.getPrevSlug(slug),
		]);

		const baseUrl = new URL(request.url).origin;
		const response = {
			data: project,
			navigation: {
				next: nextSlug ? `${baseUrl}/projects/${nextSlug}` : null,
				prev: prevSlug ? `${baseUrl}/projects/${prevSlug}` : null,
			},
		};

		return Res.ok(response);
	}

	static async update(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		try {
			const project = await new ProjectService(repository).update(slug, body as never);
			if (!project) return Res.notFound();
			return Res.ok(project);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
				return Res.conflict("A project with this slug already exists");
			}
			throw err;
		}
	}

	static async delete(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const deleted = await new ProjectService(repository).delete(slug);
		if (!deleted) return Res.notFound();
		return Res.ok({ message: "Deleted successfully" });
	}

	static getTagProject = async (c: Context<AppEnv>) => {
		const tags = await new TagService(new TagRepository(c.env.DB)).listByProject(c.get('projectId'));
		return c.json(tags);
	}
}
