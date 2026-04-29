import { PaginatedResult, PaginationParams, TagRow, Tag, Author } from "../../shared/interfaces";
import type { Project, ProjectRow, IProjectRepository, CreateProjectDto, UpdateProjectDto, ProjectDetailEmbed } from "./projects.interface";

export class ProjectRepository implements IProjectRepository {
	constructor(private readonly db: D1Database) { }

	async findAll({ page, limit, search, sort, order }: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Project>> {
		const ALLOWED_SORT = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeSort = typeof sort === 'string' && ALLOWED_SORT.includes(sort) ? sort : 'created_at';
		const safeOrder = typeof order === 'string' && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
		const offset = (page - 1) * limit;

		const conditions: string[] = ['1=1'];
		const bindings: unknown[] = [];
		let idx = 1;

		if (onlyPublished) {
			conditions.push('published = 1');
		}

		if (search) {
			const like = `%${search}%`;
			conditions.push(`(title LIKE ?${idx} OR slug LIKE ?${idx + 1} OR description LIKE ?${idx + 2})`);
			bindings.push(like, like, like);
			idx += 3;
		}

		const where = conditions.join(' AND ');

		const [dataResult, countRow] = await Promise.all([
			this.db
				.prepare(`SELECT * FROM projects WHERE ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ?${idx} OFFSET ?${idx + 1}`)
				.bind(...bindings, limit, offset)
				.all<ProjectRow>(),
			this.db
				.prepare(`SELECT COUNT(*) as count FROM projects WHERE ${where}`)
				.bind(...bindings)
				.first<{ count: number }>(),
		]);

		const total = countRow?.count ?? 0;
		const data = await Promise.all((dataResult.results as ProjectRow[]).map((row) => this.hydrate(row)));

		return {
			data,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	}

	async findBySlug(slug: string): Promise<Project | null> {
		const row = await this.db
			.prepare("SELECT * FROM projects WHERE slug = ?1")
			.bind(slug)
			.first<ProjectRow>();

		if (!row) return null;

		const [project, detailsRow] = await Promise.all([
			this.hydrate(row),
			this.db
				.prepare("SELECT content, demo_url, repo_url, tech_stack, status FROM project_details WHERE project_id = ?1")
				.bind(row.id)
				.first<{ content: string; demo_url: string; repo_url: string; tech_stack: string; status: string }>(),
		]);

		if (detailsRow) {
			project.details = {
				content: detailsRow.content,
				demoUrl: detailsRow.demo_url,
				repoUrl: detailsRow.repo_url,
				techStack: JSON.parse(detailsRow.tech_stack || '[]'),
				status: detailsRow.status as ProjectDetailEmbed['status'],
			};
		}

		return project;
	}

	async getNextSlug(currentSlug: string): Promise<string | null> {
		const row = await this.db
			.prepare("SELECT created_at FROM projects WHERE slug = ?1")
			.bind(currentSlug)
			.first<{ created_at: string }>();

		if (!row) return null;

		const result = await this.db
			.prepare("SELECT slug FROM projects WHERE created_at > ?1 ORDER BY created_at ASC LIMIT 1")
			.bind(row.created_at)
			.first<{ slug: string }>();

		return result?.slug ?? null;
	}

	async getPrevSlug(currentSlug: string): Promise<string | null> {
		const row = await this.db
			.prepare("SELECT created_at FROM projects WHERE slug = ?1")
			.bind(currentSlug)
			.first<{ created_at: string }>();

		if (!row) return null;

		const result = await this.db
			.prepare("SELECT slug FROM projects WHERE created_at < ?1 ORDER BY created_at DESC LIMIT 1")
			.bind(row.created_at)
			.first<{ slug: string }>();

		return result?.slug ?? null;
	}

	async create(dto: CreateProjectDto): Promise<Project> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db
			.prepare(
				"INSERT INTO projects (id, title, slug, description, thumbnail, published, languages, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
			)
			.bind(id, dto.title, dto.slug, dto.description, dto.thumbnail ?? "", dto.published ? 1 : 0, JSON.stringify(dto.languages ?? []), now, now)
			.run();

		if (dto.tags?.length) {
			await this.db.batch(
				dto.tags.map((t) =>
					this.db.prepare("INSERT INTO tags (tag, description, project_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", id)
				)
			);
		}

		if (dto.contributor_ids?.length) {
			await this.db.batch(
				dto.contributor_ids.map((aid) =>
					this.db.prepare("INSERT OR IGNORE INTO project_contributors (project_id, author_id) VALUES (?1, ?2)").bind(id, aid)
				)
			);
		}

		await this.upsertDetails(id, dto, now);

		const row = await this.db.prepare("SELECT * FROM projects WHERE id = ?1").bind(id).first<ProjectRow>();
		return this.hydrateWithDetails(row!);
	}

	async update(slug: string, dto: UpdateProjectDto): Promise<Project | null> {
		const existing = await this.db
			.prepare("SELECT * FROM projects WHERE slug = ?1")
			.bind(slug)
			.first<ProjectRow>();

		if (!existing) return null;

		const fields: string[] = [];
		const values: unknown[] = [];
		let idx = 1;

		if (dto.title !== undefined) { fields.push(`title = ?${idx++}`); values.push(dto.title); }
		if (dto.slug !== undefined) { fields.push(`slug = ?${idx++}`); values.push(dto.slug); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.thumbnail !== undefined) { fields.push(`thumbnail = ?${idx++}`); values.push(dto.thumbnail); }
		if (dto.published !== undefined) { fields.push(`published = ?${idx++}`); values.push(dto.published ? 1 : 0); }
		if (dto.languages !== undefined) { fields.push(`languages = ?${idx++}`); values.push(JSON.stringify(dto.languages)); }

		fields.push(`updated_at = ?${idx++}`);
		values.push(new Date().toISOString());
		values.push(existing.id);

		await this.db
			.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?${idx}`)
			.bind(...values)
			.run();

		if (dto.tags !== undefined) {
			await this.db.prepare("DELETE FROM tags WHERE project_id = ?1").bind(existing.id).run();
			if (dto.tags.length) {
				await this.db.batch(
					dto.tags.map((t) =>
						this.db.prepare("INSERT INTO tags (tag, description, project_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", existing.id)
					)
				);
			}
		}

		if (dto.contributor_ids !== undefined) {
			await this.db.prepare("DELETE FROM project_contributors WHERE project_id = ?1").bind(existing.id).run();
			if (dto.contributor_ids.length) {
				await this.db.batch(
					dto.contributor_ids.map((aid) =>
						this.db.prepare("INSERT OR IGNORE INTO project_contributors (project_id, author_id) VALUES (?1, ?2)").bind(existing.id, aid)
					)
				);
			}
		}

		await this.upsertDetails(existing.id, dto, new Date().toISOString());

		const newSlug = dto.slug ?? slug;
		const updated = await this.db.prepare("SELECT * FROM projects WHERE slug = ?1").bind(newSlug).first<ProjectRow>();
		return this.hydrateWithDetails(updated!);
	}

	async delete(slug: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM projects WHERE slug = ?1")
			.bind(slug)
			.run();
		return result.meta.changes > 0;
	}

	private async upsertDetails(projectId: string, dto: { content?: string; demoUrl?: string; repoUrl?: string; techStack?: string[]; status?: string }, now: string): Promise<void> {
		const ALLOWED_STATUS = ['in-progress', 'completed', 'archived'];
		const existing = await this.db
			.prepare("SELECT id FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<{ id: string }>();

		if (!existing) {
			const detailId = crypto.randomUUID();
			const safeStatus = ALLOWED_STATUS.includes(dto.status ?? '') ? dto.status! : 'in-progress';
			await this.db
				.prepare(
					"INSERT INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
				)
				.bind(
					detailId, projectId,
					dto.content ?? '', dto.demoUrl ?? '', dto.repoUrl ?? '',
					JSON.stringify(dto.techStack ?? []), safeStatus, now, now
				)
				.run();
		} else {
			const fields: string[] = [];
			const values: unknown[] = [];
			let idx = 1;

			if (dto.content !== undefined) { fields.push(`content = ?${idx++}`); values.push(dto.content); }
			if (dto.demoUrl !== undefined) { fields.push(`demo_url = ?${idx++}`); values.push(dto.demoUrl); }
			if (dto.repoUrl !== undefined) { fields.push(`repo_url = ?${idx++}`); values.push(dto.repoUrl); }
			if (dto.techStack !== undefined) { fields.push(`tech_stack = ?${idx++}`); values.push(JSON.stringify(dto.techStack)); }
			if (dto.status !== undefined && ALLOWED_STATUS.includes(dto.status)) {
				fields.push(`status = ?${idx++}`);
				values.push(dto.status);
			}

			if (fields.length > 0) {
				fields.push(`updated_at = ?${idx++}`);
				values.push(now);
				values.push(projectId);

				await this.db
					.prepare(`UPDATE project_details SET ${fields.join(", ")} WHERE project_id = ?${idx}`)
					.bind(...values)
					.run();
			}
		}
	}

	private async hydrateWithDetails(row: ProjectRow): Promise<Project> {
		const project = await this.hydrate(row);
		const detailsRow = await this.db
			.prepare("SELECT content, demo_url, repo_url, tech_stack, status FROM project_details WHERE project_id = ?1")
			.bind(row.id)
			.first<{ content: string; demo_url: string; repo_url: string; tech_stack: string; status: string }>();

		if (detailsRow) {
			project.details = {
				content: detailsRow.content,
				demoUrl: detailsRow.demo_url,
				repoUrl: detailsRow.repo_url,
				techStack: JSON.parse(detailsRow.tech_stack || '[]'),
				status: detailsRow.status as ProjectDetailEmbed['status'],
			};
		}

		return project;
	}

	private async hydrate(row: ProjectRow): Promise<Project> {
		const [tagsResult, contributorsResult] = await Promise.all([
			this.db
				.prepare("SELECT id, tag, description FROM tags WHERE project_id = ?1")
				.bind(row.id)
				.all<Tag>(),
			this.db
				.prepare(
					"SELECT a.name, a.profile, a.url FROM project_contributors pc JOIN authors a ON pc.author_id = a.id WHERE pc.project_id = ?1"
				)
				.bind(row.id)
				.all<Author>(),
		]);

		const tags: Tag[] = tagsResult.results;
		const contributors: Author[] = contributorsResult.results.map((a) => ({
			name: a.name,
			profile: a.profile,
			url: a.url,
		}));

		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			description: row.description,
			tags,
			contributors,
			languages: JSON.parse(row.languages || '[]'),
			thumbnail: row.thumbnail,
			published: row.published === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}
