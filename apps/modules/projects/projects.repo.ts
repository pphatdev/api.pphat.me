import { PaginatedResult, PaginationParams } from "../../shared/interfaces";
import { Tag } from "../tags/tags.interface";
import { Author, AuthorRow, AuthorDetailRow } from "../authors/authors.interface";

import { getNextSlug, getPrevSlug, buildUpdateFields, buildListConditions, getStatsSummary, mapAuthorRow } from "../../shared/helpers/repo";
import type { Project, ProjectRow, IProjectRepository, CreateProjectDto, UpdateProjectDto, ProjectDetailEmbed } from "./projects.interface";

export class ProjectRepository implements IProjectRepository {
	constructor(private readonly db: D1Database) { }

	async findAll({ page, limit, search, sort, order }: PaginationParams, onlyPublished = true): Promise<PaginatedResult<Project>> {
		const ALLOWED_SORT = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeSort = sort?.[0] && ALLOWED_SORT.includes(sort[0]) ? sort[0] : 'created_at';
		const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
		const offset = (page - 1) * limit;

		const { conditions, bindings, nextIdx } = buildListConditions(search, onlyPublished);
		const where = conditions.join(' AND ');

		const [dataResult, countRow] = await Promise.all([
			this.db
				.prepare(`SELECT * FROM projects WHERE ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ?${nextIdx} OFFSET ?${nextIdx + 1}`)
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
		return getNextSlug(this.db, 'projects', currentSlug);
	}

	async getPrevSlug(currentSlug: string): Promise<string | null> {
		return getPrevSlug(this.db, 'projects', currentSlug);
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
		const existing = await this.findBySlug(slug);
		if (!existing) return null;

		const mappings: [keyof UpdateProjectDto, string, ((v: any) => any)?][] = [
			['title', 'title'],
			['slug', 'slug'],
			['description', 'description'],
			['thumbnail', 'thumbnail'],
			['published', 'published', (v) => (v ? 1 : 0)],
			['languages', 'languages', (v) => JSON.stringify(v)],
		];

		const { fields, values, nextIdx } = buildUpdateFields(dto, mappings);

		if (fields.length > 0) {
			fields.push(`updated_at = ?${nextIdx}`);
			values.push(new Date().toISOString());
			values.push(existing.id);
			await this.db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?${nextIdx + 1}`).bind(...values).run();
		}

		if (dto.tags !== undefined) await this.updateTags(existing.id, dto.tags);
		if (dto.contributor_ids !== undefined) await this.updateContributors(existing.id, dto.contributor_ids);
		await this.upsertDetails(existing.id, dto, new Date().toISOString());

		return this.findBySlug(dto.slug ?? slug);
	}

	private async updateTags(projectId: string, tags: { tag: string; description?: string }[]): Promise<void> {
		await this.db.prepare("DELETE FROM tags WHERE project_id = ?1").bind(projectId).run();
		if (tags.length > 0) {
			await this.db.batch(
				tags.map((t) =>
					this.db.prepare("INSERT INTO tags (tag, description, project_id) VALUES (?1, ?2, ?3)").bind(t.tag, t.description ?? "", projectId)
				)
			);
		}
	}

	private async updateContributors(projectId: string, contributorIds: number[]): Promise<void> {
		await this.db.prepare("DELETE FROM project_contributors WHERE project_id = ?1").bind(projectId).run();
		if (contributorIds.length > 0) {
			await this.db.batch(
				contributorIds.map((aid) =>
					this.db.prepare("INSERT OR IGNORE INTO project_contributors (project_id, author_id) VALUES (?1, ?2)").bind(projectId, aid)
				)
			);
		}
	}

	async delete(slug: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM projects WHERE slug = ?1")
			.bind(slug)
			.run();
		return result.meta.changes > 0;
	}

	async incrementViews(projectId: string): Promise<void> {
		await this.db
			.prepare(
				"INSERT INTO project_stats (project_id, views) VALUES (?1, 1) ON CONFLICT(project_id) DO UPDATE SET views = views + 1"
			)
			.bind(projectId)
			.run();
	}

	async findTop(limit: number): Promise<Project[]> {
		const result = await this.db
			.prepare(`
				SELECT p.* 
				FROM projects p 
				JOIN project_stats s ON p.id = s.project_id 
				WHERE p.published = 1 
				ORDER BY s.views DESC 
				LIMIT ?1
			`)
			.bind(limit)
			.all<ProjectRow>();
		
		return Promise.all((result.results as ProjectRow[]).map(row => this.hydrate(row)));
	}

	async getStatsSummary(): Promise<{ total: number; published: number; draft: number }> {
		return getStatsSummary(this.db, 'projects');
	}

	private async upsertDetails(projectId: string, dto: { content?: string; demoUrl?: string; repoUrl?: string; techStack?: string[]; status?: string }, now: string): Promise<void> {
		const ALLOWED_STATUS = ['in-progress', 'completed', 'archived'];
		const existing = await this.db
			.prepare("SELECT id FROM project_details WHERE project_id = ?1")
			.bind(projectId)
			.first<{ id: string }>();

		if (!existing) {
			await this.insertDetails(projectId, dto, now, ALLOWED_STATUS);
		} else {
			await this.updateDetails(projectId, dto, now, ALLOWED_STATUS);
		}
	}

	private async insertDetails(projectId: string, dto: any, now: string, allowedStatus: string[]): Promise<void> {
		const safeStatus = allowedStatus.includes(dto.status ?? '') ? dto.status! : 'in-progress';
		await this.db
			.prepare(
				"INSERT INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
			)
			.bind(
				crypto.randomUUID(), projectId,
				dto.content ?? '', dto.demoUrl ?? '', dto.repoUrl ?? '',
				JSON.stringify(dto.techStack ?? []), safeStatus, now, now
			)
			.run();
	}

	private async updateDetails(projectId: string, dto: any, now: string, allowedStatus: string[]): Promise<void> {
		const mappings: [keyof UpdateProjectDto | 'demoUrl' | 'repoUrl' | 'techStack', string, ((v: any) => any)?][] = [
			['content', 'content'],
			['demoUrl', 'demo_url'],
			['repoUrl', 'repo_url'],
			['techStack', 'tech_stack', (v) => JSON.stringify(v)],
			['status', 'status', (v) => (allowedStatus.includes(v) ? v : undefined)],
		];

		const { fields, values, nextIdx } = buildUpdateFields(dto, mappings as any);

		if (fields.length > 0) {
			fields.push(`updated_at = ?${nextIdx}`);
			values.push(now);
			values.push(projectId);
			await this.db.prepare(`UPDATE project_details SET ${fields.join(", ")} WHERE project_id = ?${nextIdx + 1}`).bind(...values).run();
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

	public async hydrate(row: ProjectRow): Promise<Project> {
		const [tagsResult, contributorsResult] = await Promise.all([
			this.db
				.prepare("SELECT id, tag, description FROM tags WHERE project_id = ?1")
				.bind(row.id)
				.all<Tag>(),
			this.db
				.prepare(
					"SELECT a.id, a.name, a.profile, a.url, ad.bio, ad.avatar_url, ad.social_links, ad.status, ad.created_at, ad.updated_at FROM project_contributors pc JOIN authors a ON pc.author_id = a.id LEFT JOIN author_details ad ON a.id = ad.author_id WHERE pc.project_id = ?1"
				)
				.bind(row.id)
				.all<AuthorRow & AuthorDetailRow>(),
		]);

		const tags: Tag[] = tagsResult.results;
		const contributors: Author[] = contributorsResult.results.map((a: any) => mapAuthorRow(a));

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
