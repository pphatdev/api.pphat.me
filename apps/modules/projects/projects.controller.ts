import type { Context, Next } from 'hono';
import { json } from "../../shared/helpers/json";
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
		const url = new URL(request.url);
		const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search = url.searchParams.get("search") ?? undefined;
		const sort = url.searchParams.get("sort") ?? undefined;
		const orderParam = url.searchParams.get("order")?.toLowerCase();
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const result = await new ProjectService(repository).list({ page, limit, search, sort, order });
		return json(result);
	}

	static async create(request: Request, env: Env): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		const { title, slug, description } = body as Record<string, unknown>;
		if (!title || !slug || !description) {
			return json({ error: "title, slug and description are required" }, 422);
		}

		try {
			const project = await new ProjectService(repository).create(body as never);
			return json(project, 201);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
				return json({ error: "A project with this slug already exists" }, 409);
			}
			throw err;
		}
	}

	static async getBySlug(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const project = await new ProjectService(repository).getBySlug(slug);
		if (!project) return json({ error: "Not Found" }, 404);
		return json(project);
	}

	static async update(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

		try {
			const project = await new ProjectService(repository).update(slug, body as never);
			if (!project) return json({ error: "Not Found" }, 404);
			return json(project);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
				return json({ error: "A project with this slug already exists" }, 409);
			}
			throw err;
		}
	}

	static async delete(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const deleted = await new ProjectService(repository).delete(slug);
		if (!deleted) return json({ error: "Not Found" }, 404);
		return json({ message: "Deleted successfully" });
	}

	static getTagProject = async (c: Context<AppEnv>) => {
		const tags = await new TagService(new TagRepository(c.env.DB)).listByProject(c.get('projectId'));
		return c.json(tags);
	}
}
