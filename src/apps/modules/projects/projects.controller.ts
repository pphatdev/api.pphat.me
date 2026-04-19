import { json } from "../../../shared/helpers/json";
import { ProjectRepository } from "./projects.repo";
import {
	CreateProject,
	DeleteProject,
	GetProjectBySlug,
	ListProjects,
	UpdateProject,
} from "./projects.service";

export class ProjectsController {
	static async handle(request: Request, env: Env, slug?: string): Promise<Response> {
		const repository = new ProjectRepository(env.DB);
		const method = request.method;

		// Collection: /v1/api/projects
		if (!slug) {
			if (method === "GET") {
				const url = new URL(request.url);
				const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
				const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
				const search = url.searchParams.get("search") ?? undefined;
				const sort = url.searchParams.get("sort") ?? undefined;
				const orderParam = url.searchParams.get("order")?.toLowerCase();
				const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
				const result = await new ListProjects(repository).execute({ page, limit, search, sort, order });
				return json(result);
			}

			if (method === "POST") {
				const body = await request.json().catch(() => null);
				if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

				const { title, slug: bodySlug, description } = body as Record<string, unknown>;
				if (!title || !bodySlug || !description) {
					return json({ error: "title, slug and description are required" }, 422);
				}

				try {
					const project = await new CreateProject(repository).execute(body as never);
					return json(project, 201);
				} catch (err) {
					if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
						return json({ error: "A project with this slug already exists" }, 409);
					}
					if (err instanceof Error && err.message.startsWith("Tags not found:")) {
						return json({ error: err.message }, 422);
					}
					throw err;
				}
			}

			return json({ error: "Method Not Allowed" }, 405);
		}

		// Detail: /v1/api/projects/:slug
		if (method === "GET") {
			const project = await new GetProjectBySlug(repository).execute(slug);
			if (!project) return json({ error: "Not Found" }, 404);
			return json(project);
		}

		if (method === "PUT" || method === "PATCH") {
			const body = await request.json().catch(() => null);
			if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

			try {
				const project = await new UpdateProject(repository).execute(slug, body as never);
				if (!project) return json({ error: "Not Found" }, 404);
				return json(project);
			} catch (err) {
				if (err instanceof Error && err.message.includes("UNIQUE constraint failed: projects.slug")) {
					return json({ error: "A project with this slug already exists" }, 409);
				}
				if (err instanceof Error && err.message.startsWith("Tags not found:")) {
					return json({ error: err.message }, 422);
				}
				throw err;
			}
		}

		if (method === "DELETE") {
			const deleted = await new DeleteProject(repository).execute(slug);
			if (!deleted) return json({ error: "Not Found" }, 404);
			return json({ message: "Deleted successfully" });
		}

		return json({ error: "Method Not Allowed" }, 405);
	}
}
