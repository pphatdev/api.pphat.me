import { PaginatedResult, PaginationParams, TagRow, Tag, Author } from "../../shared/interfaces";
import type { Project, ProjectRow, IProjectRepository, CreateProjectDto, UpdateProjectDto, ProjectDetailEmbed } from "./projects.interface";

export class ProjectRepository implements IProjectRepository {
	constructor(private readonly db: D1Database) {}

	async findAll({ page, limit, search, sort, order }: PaginationParams): Promise<PaginatedResult<Project>> {
		const ALLOWED_SORT = ['id', 'title', 'slug', 'description', 'published', 'created_at', 'updated_at'];
		const safeSort = ALLOWED_SORT.includes(sort ?? '') ? sort! : 'created_at';
		const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
		const offset = (page - 1) * limit;

		let dataResult: Awaited<ReturnType<D1PreparedStatement['all']>>;
		let countRow: { count: number } | null;

		if (search) {
			const like = `%${search}%`;
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM projects WHERE (title LIKE ?1 OR slug LIKE ?2 OR description LIKE ?3) ORDER BY ${safeSort} ${safeOrder} LIMIT ?4 OFFSET ?5`)
					.bind(like, like, like, limit, offset)
					.all<ProjectRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM projects WHERE (title LIKE ?1 OR slug LIKE ?2 OR description LIKE ?3)")
					.bind(like, like, like)
					.first<{ count: number }>(),
			]);
		} else {
			[dataResult, countRow] = await Promise.all([
				this.db
					.prepare(`SELECT * FROM projects ORDER BY ${safeSort} ${safeOrder} LIMIT ?1 OFFSET ?2`)
					.bind(limit, offset)
					.all<ProjectRow>(),
				this.db
					.prepare("SELECT COUNT(*) as count FROM projects")
					.first<{ count: number }>(),
			]);
		}

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

		const row = await this.db.prepare("SELECT * FROM projects WHERE id = ?1").bind(id).first<ProjectRow>();
		return this.hydrate(row!);
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

		if (dto.title !== undefined)       { fields.push(`title = ?${idx++}`);       values.push(dto.title); }
		if (dto.slug !== undefined)        { fields.push(`slug = ?${idx++}`);        values.push(dto.slug); }
		if (dto.description !== undefined) { fields.push(`description = ?${idx++}`); values.push(dto.description); }
		if (dto.thumbnail !== undefined)   { fields.push(`thumbnail = ?${idx++}`);   values.push(dto.thumbnail); }
		if (dto.published !== undefined)   { fields.push(`published = ?${idx++}`);   values.push(dto.published ? 1 : 0); }
		if (dto.languages !== undefined)   { fields.push(`languages = ?${idx++}`);   values.push(JSON.stringify(dto.languages)); }

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

		const newSlug = dto.slug ?? slug;
		const updated = await this.db.prepare("SELECT * FROM projects WHERE slug = ?1").bind(newSlug).first<ProjectRow>();
		return this.hydrate(updated!);
	}

	async delete(slug: string): Promise<boolean> {
		const result = await this.db
			.prepare("DELETE FROM projects WHERE slug = ?1")
			.bind(slug)
			.run();
		return result.meta.changes > 0;
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
