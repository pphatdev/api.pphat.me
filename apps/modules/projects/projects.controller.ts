import type { Context, Next } from 'hono';
import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";
import { AppEnv } from "./projects.interface";
import { ProjectRepository } from "./projects.repo";
import { TagService } from "../tags/tags.service";
import { TagRepository } from "../tags/tags.repo";
import { ProjectService } from "./projects.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProjectsController {

	/**
	 * @description Middleware to resolve project ID from slug
	 * @param { Context } c The Hono context
	 * @param { Next } next The next middleware
	 * @returns { Promise<Response | void> }
	 */
	static resolveProject = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const project = await c.env.DB
			.prepare('SELECT id FROM projects WHERE slug = ?1')
			.bind(c.req.param('slug'))
			.first<{ id: string }>();
		if (!project) return c.json({ error: 'Not Found' }, 404);
		c.set('projectId', project.id);
		return next();
	};

	/**
	 * @description Authenticated: list projects.
	 *  - Non-admin: only `published=1`. Drafts hidden.
	 *  - Admin: sees every project regardless of `published`.
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Paginated list of projects
	 */
	static async list(c: Context<AppEnv>): Promise<Response> {
		const repository = new ProjectRepository(c.env.DB);
		const options = parseListParams(c.req.url);
		const isAdmin = c.get('user')?.role === 'admin';
		const result = await new ProjectService(repository).list(options, true, { admin: isAdmin });
		return Res.ok(result);
	}

	/**
	 * @description Create a new project
	 * @method POST
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @returns { Promise<Response> } The created project
	 */
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

	/**
	 * @description Get a project by its slug
	 * @method GET
	 * @param { Context } c The Hono context
	 * @returns { Promise<Response> } The project details
	 */
	static async getBySlug(c: Context<AppEnv>): Promise<Response> {
		const slug = c.req.param('slug')!;
		const repository = new ProjectRepository(c.env.DB);
		const project = await new ProjectService(repository).getBySlug(slug);
		if (!project) return Res.notFound();

		// Increment views in background
		c.executionCtx.waitUntil(
			repository.incrementViews(project.id).catch(err => console.error("Failed to increment project views:", err))
		);

		const [nextSlug, prevSlug] = await Promise.all([
			repository.getNextSlug(slug),
			repository.getPrevSlug(slug),
		]);

		const baseUrl = new URL(c.req.url).origin;
		const response = {
			data: project,
			navigation: {
				next: nextSlug ? `${baseUrl}/projects/${nextSlug}` : null,
				prev: prevSlug ? `${baseUrl}/projects/${prevSlug}` : null,
			},
		};

		return Res.ok(response);
	}

	/**
	 * @description Update an existing project
	 * @method PUT
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } slug The project slug
	 * @returns { Promise<Response> } The updated project
	 */
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

	/**
	 * @description Delete a project
	 * @method DELETE
	 * @param { Request } request The incoming request
	 * @param { Env } env Environment bindings
	 * @param { string } slug The project slug
	 * @returns { Promise<Response> } Success message
	 */
	static async delete(request: Request, env: Env, slug: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const deleted = await new ProjectService(repository).delete(slug);
		if (!deleted) return Res.notFound();
		return Res.ok({ message: "Deleted successfully" });
	}

	/**
	 * @description Get tags associated with a project
	 * @method GET
	 * @param { Context } c The Hono context
	 * @returns { Promise<Response> } List of tags
	 */
	static getTagProject = async (c: Context<AppEnv>) => {
		const tags = await new TagService(new TagRepository(c.env.DB)).listByProject(c.get('projectId'));
		return c.json(tags);
	}

	/**
	 * @description Authenticated: get project order sequence list
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Ordered list of projects
	 */
	static async getOrderSequence(c: Context<AppEnv>): Promise<Response> {
		const repository = new ProjectRepository(c.env.DB);
		const list = await new ProjectService(repository).getOrderSequence();
		return Res.ok(list);
	}

	/**
	 * @description Admin: update the project order sequence.
	 * Accepts:
	 *   - `{ ids: string[] }` or `{ sequence: string[] }` or `string[]` (assigns positions 0..N-1)
	 *   - `{ sequence: { id: string; sequence?: number; position?: number }[] }`
	 *   - `Array<{ id: string; sequence?: number; position?: number }>`
	 * @method PUT, PATCH
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } `{ updated: number, message: string }`
	 */
	static async updateOrderSequence(c: Context<AppEnv>): Promise<Response> {
		if (c.get('user')?.role !== 'admin') return Res.forbidden();

		const body = await c.req.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return Res.unprocessable('Invalid JSON body');
		}

		let items: unknown = body;
		if (!Array.isArray(body)) {
			items = (body as any).sequence ?? (body as any).ids ?? (body as any).project_ids ?? (body as any).projectIds ?? (body as any).order ?? (body as any).items;
		}

		if (!Array.isArray(items) || items.length === 0) {
			return Res.unprocessable('Payload must be a non-empty array or an object containing an ids/sequence array');
		}

		const repository = new ProjectRepository(c.env.DB);
		const service = new ProjectService(repository);

		// Case 1: Array of UUID strings: ["id1", "id2", ...]
		if (typeof items[0] === 'string') {
			for (const id of items) {
				if (typeof id !== 'string' || !UUID_RE.test(id)) {
					return Res.unprocessable('All IDs must be valid project UUIDs');
				}
			}
			const updated = await service.reorder(items as string[]);
			return Res.ok({ updated, message: 'Project order sequence updated successfully' });
		}

		// Case 2: Array of objects: [{ id, sequence?, position?, order? }, ...]
		if (typeof items[0] === 'object' && items[0] !== null) {
			const sequenceItems: { id: string; sequence: number }[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i] as any;
				const id = item?.id ?? item?.project_id ?? item?.projectId;
				if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
					return Res.unprocessable('Each item must include a valid project UUID id');
				}
				const rawSeq = item?.sequence ?? item?.position ?? item?.order;
				const seqNum = (rawSeq !== undefined && rawSeq !== null) ? Number(rawSeq) : i;
				if (!Number.isInteger(seqNum) || seqNum < 0) {
					return Res.unprocessable('Sequence numbers must be non-negative integers');
				}
				sequenceItems.push({ id, sequence: seqNum });
			}

			const updated = await service.updateOrderSequence(sequenceItems);
			return Res.ok({ updated, message: 'Project order sequence updated successfully' });
		}

		return Res.unprocessable('Invalid sequence item format');
	}
}
