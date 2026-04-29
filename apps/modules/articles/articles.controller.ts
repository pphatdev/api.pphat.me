import type { Context, Next } from 'hono';
import { Res } from "../../shared/helpers/response";
import { isObject } from "../../shared/helpers/json";
import { parseListParams } from "../../shared/helpers/query";
import { AppEnv } from "./articles.interface";
import { ArticleRepository } from "./articles.repo";
import { ArticleService } from "./articles.service";
import { TagRepository } from "../tags/tags.repo";
import { TagService } from "../tags/tags.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ArticlesController {

	private static getParamId(c: Context<AppEnv>): string | null {
		const id = c.req.param('id') || '';
		return UUID_RE.test(id) ? id : null;
	}

	private static async getArticleOwner(id: string, db: D1Database): Promise<{ owner_id: string | null } | null> {
		return db.prepare('SELECT owner_id FROM articles WHERE id = ?1').bind(id).first<{ owner_id: string | null }>();
	}

	private static canManageContributors(user: any, ownerId: string | null): boolean {
		if (!user) return false;
		return user.role === 'admin' || user.sub === ownerId;
	}

	/**
	 * Middleware: resolve a :slug param to an article ID (for sub-resource routes).
	 */
	static resolveArticle = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const param = c.req.param('slug') ?? '';
		let id: string | undefined;

		if (UUID_RE.test(param)) {
			const row = await c.env.DB
				.prepare('SELECT id FROM articles WHERE id = ?1')
				.bind(param)
				.first<{ id: string }>();
			id = row?.id;
		} else {
			const row = await c.env.DB
				.prepare('SELECT id FROM articles WHERE slug = ?1')
				.bind(param)
				.first<{ id: string }>();
			id = row?.id;
		}

		if (!id) return Res.notFound();
		c.set('articleId', id);
		return next();
	};

	/**
	 * Middleware: resolve :id param and verify write access (owner | contributor | admin).
	 * Used for PUT/PATCH routes.
	 */
	static requireWriteAccess = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const id = c.req.param('id') || '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');
		const article = await c.env.DB
			.prepare('SELECT id, owner_id FROM articles WHERE id = ?1')
			.bind(id)
			.first<{ id: string; owner_id: string | null }>();

		if (!article) return Res.notFound();

		const hasAccess = await ArticlesController.checkAccess(id, user, article.owner_id, c.env.DB);
		if (!hasAccess) return Res.forbidden();

		c.set('articleId', id);
		return next();
	};

	private static async checkAccess(id: string, user: any, ownerId: string | null, db: D1Database): Promise<boolean> {
		if (!user) return false;
		if (user.role === 'admin' || user.sub === ownerId) return true;
		return new ArticleRepository(db).isContributor(id, user.sub);
	}

	/**
	 * Middleware: resolve :id param and verify delete access (owner | admin only).
	 */
	static requireDeleteAccess = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const id = ArticlesController.getParamId(c);
		if (!id) return Res.badRequest('Invalid article ID');

		const article = await ArticlesController.getArticleOwner(id, c.env.DB);
		if (!article) return Res.notFound();

		const user = c.get('user');
		const canDelete = user?.role === 'admin' || (user && article.owner_id === user.sub);
		if (!canDelete) return Res.forbidden();

		c.set('articleId', id);
		return next();
	};

	/**
	 * Public: list all published articles
	 */
	static async list(c: Context<AppEnv>): Promise<Response> {
		const repository = new ArticleRepository(c.env.DB);
		const options = parseListParams(c.req.url);
		const result = await new ArticleService(repository).list(options, true);
		return Res.ok(result);
	}

	/**
	 * Protected: list articles by authorId (includes drafts for owner/admin)
	 */
	static async listByAuthor(c: Context<AppEnv>): Promise<Response> {
		const authorId = parseInt(c.req.param('authorId') ?? '', 10);
		if (isNaN(authorId) || authorId < 1) return Res.badRequest('Invalid author ID');

		const authorRow = await c.env.DB
			.prepare('SELECT user_id FROM authors WHERE id = ?1')
			.bind(authorId)
			.first<{ user_id: string | null }>();

		if (!authorRow) return Res.notFound('Author not found');

		const user = c.get('user');
		const onlyPublished = !(user?.role === 'admin' || (user && authorRow.user_id === user.sub));

		const options = parseListParams(c.req.url);
		const result = await new ArticleService(new ArticleRepository(c.env.DB)).listByAuthor(authorId, options, onlyPublished);
		return Res.ok(result);
	}

	/**
	 * Public: get by slug or UUID id
	 */
	static async getBySlugOrId(c: Context<AppEnv>): Promise<Response> {
		const param = c.req.param('slug') ?? '';

		const repository = new ArticleRepository(c.env.DB);
		const service = new ArticleService(repository);
		const article = UUID_RE.test(param)
			? await service.getById(param)
			: await service.getBySlug(param);
		if (!article) return Res.notFound();

		const [nextSlug, prevSlug] = await Promise.all([
			repository.getNextSlug(article.slug),
			repository.getPrevSlug(article.slug),
		]);

		const baseUrl = new URL(c.req.url).origin;
		const response = {
			data: article,
			navigation: {
				next: nextSlug ? `${baseUrl}/articles/${nextSlug}` : null,
				prev: prevSlug ? `${baseUrl}/articles/${prevSlug}` : null,
			},
		};

		return Res.ok(response);
	}

	/**
	 * Authenticated: create article
	 */
	static async create(c: Context<AppEnv>): Promise<Response> {
		const body = await c.req.json().catch(() => null);
		if (!isObject(body)) return Res.badRequest("Invalid request body. Expected JSON.");

		const { title, slug, description } = body;
		if (!title || !slug || !description) return Res.unprocessable("title, slug and description are required");

		try {
			const repo = new ArticleRepository(c.env.DB);
			const article = await repo.create({ ...body, owner_id: c.get('user')?.sub } as any);
			return Res.created(article);
		} catch (err) {
			return ArticlesController.handleSlugConflict(err);
		}
	}

	private static handleSlugConflict(err: unknown): Response {
		if (err instanceof Error && err.message.includes("UNIQUE constraint failed: articles.slug")) {
			return Res.conflict("An article with this slug already exists");
		}
		throw err;
	}

	/**
	 * Protected: update article (owner | contributor | admin)
	 */
	static async update(c: Context<AppEnv>): Promise<Response> {
		const id = c.get('articleId'); // set by requireWriteAccess
		const body = await c.req.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		try {
			const article = await new ArticleService(new ArticleRepository(c.env.DB)).update(id, body as never);
			if (!article) return Res.notFound();
			return Res.ok(article);
		} catch (err) {
			return ArticlesController.handleSlugConflict(err);
		}
	}

	/**
	 * Protected: delete article (owner | admin)
	 */
	static async delete(c: Context<AppEnv>): Promise<Response> {
		const id = c.get('articleId'); // set by requireDeleteAccess
		const deleted = await new ArticleService(new ArticleRepository(c.env.DB)).delete(id);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}

	/**
	 * Protected: add contributor (owner | admin)
	 */
	static async addContributor(c: Context<AppEnv>): Promise<Response> {
		const id = ArticlesController.getParamId(c);
		if (!id) return Res.badRequest('Invalid article ID');

		const article = await ArticlesController.getArticleOwner(id, c.env.DB);
		if (!article) return Res.notFound();
		if (!ArticlesController.canManageContributors(c.get('user'), article.owner_id)) return Res.forbidden();

		const body = await c.req.json().catch(() => null);
		const userId = (body as any)?.user_id || (body as any)?.userId;
		if (!userId || typeof userId !== 'string') return Res.unprocessable('user_id is required');

		try {
			await new ArticleRepository(c.env.DB).addContributor(id, userId);
			return Res.ok({ message: 'Contributor added successfully' });
		} catch (err) {
			return ArticlesController.handleContributorError(err);
		}
	}

	private static handleContributorError(err: unknown): Response {
		if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
			return Res.conflict("User is already a contributor");
		}
		throw err;
	}

	/**
	 * Authenticated: remove self as contributor
	 */
	static async removeSelfAsContributor(c: Context<AppEnv>): Promise<Response> {
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');
		const removed = await new ArticleService(new ArticleRepository(c.env.DB)).removeContributor(id, user?.sub ?? '');
		if (!removed) return Res.notFound('Not a contributor or article not found');
		return Res.noContent();
	}

	/**
	 * Public: get article tags (via resolved articleId)
	 */
	static async getTagsArticle(c: Context<AppEnv>): Promise<Response> {
		const tags = await new TagService(new TagRepository(c.env.DB)).listByArticle(c.get('articleId'));
		return Res.ok(tags);
	}
}
