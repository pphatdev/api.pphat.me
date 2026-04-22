import type { Context, Next } from 'hono';
import { Res } from "../../shared/helpers/response";
import { AppEnv } from "./articles.interface";
import { ArticleRepository } from "./articles.repo";
import { ArticleService } from "./articles.service";
import { TagRepository } from "../tags/tags.repo";
import { TagService } from "../tags/tags.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ArticlesController {

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
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');
		const repo = new ArticleRepository(c.env.DB);

		const article = await c.env.DB
			.prepare('SELECT id, owner_id FROM articles WHERE id = ?1')
			.bind(id)
			.first<{ id: string; owner_id: string | null }>();

		if (!article) return Res.notFound();

		const isAdmin = user.role === 'admin';
		const isOwner = article.owner_id === user.sub;
		const isContributor = !isAdmin && !isOwner
			? await repo.isContributor(id, user.sub)
			: false;

		if (!isAdmin && !isOwner && !isContributor) {
			return Res.forbidden();
		}

		c.set('articleId', id);
		return next();
	};

	/**
	 * Middleware: resolve :id param and verify delete access (owner | admin only).
	 */
	static requireDeleteAccess = async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');

		const article = await c.env.DB
			.prepare('SELECT id, owner_id FROM articles WHERE id = ?1')
			.bind(id)
			.first<{ id: string; owner_id: string | null }>();

		if (!article) return Res.notFound();

		const isAdmin = user.role === 'admin';
		const isOwner = article.owner_id === user.sub;

		if (!isAdmin && !isOwner) {
			return Res.forbidden();
		}

		c.set('articleId', id);
		return next();
	};

	/**
	 * Public: list all published articles
	 */
	static async list(c: Context<AppEnv>): Promise<Response> {
		const repository = new ArticleRepository(c.env.DB);
		const url = new URL(c.req.url);
		const page  = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1",  10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search      = url.searchParams.get("search") ?? undefined;
		const sortParam   = url.searchParams.get("sort");
		const orderParam  = url.searchParams.get("order")?.trim().toLowerCase();
		const sort  = sortParam ? sortParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;
		const tagsParam    = url.searchParams.get("tags");
		const authorsParam = url.searchParams.get("authors");
		const tags    = tagsParam    ? tagsParam.split(',').map(t => t.trim()).filter(Boolean)    : undefined;
		const authors = authorsParam ? authorsParam.split(',').map(a => a.trim()).filter(Boolean) : undefined;
		const result = await new ArticleService(repository).list({ page, limit, search, sort, order, tags, authors }, true);
		return Res.ok(result);
	}

	/**
	 * Protected: list articles by authorId (includes drafts for owner/admin)
	 */
	static async listByAuthor(c: Context<AppEnv>): Promise<Response> {
		const authorId = parseInt(c.req.param('authorId') ?? '', 10);
		if (isNaN(authorId) || authorId < 1) return Res.badRequest('Invalid author ID');

		const user = c.get('user');
		const isAdmin = user.role === 'admin';

		// Check if the requesting user is linked to this author profile
		let isAuthorOwner = false;
		if (!isAdmin) {
			const authorRow = await c.env.DB
				.prepare('SELECT user_id FROM authors WHERE id = ?1')
				.bind(authorId)
				.first<{ user_id: string | null }>();

			if (!authorRow) return Res.notFound('Author not found');
			isAuthorOwner = authorRow.user_id === user.sub;

			if (!isAuthorOwner) return Res.forbidden();
		}

		const repository = new ArticleRepository(c.env.DB);
		const url = new URL(c.req.url);
		const page  = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1",  10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
		const search      = url.searchParams.get("search") ?? undefined;
		const sortParam   = url.searchParams.get("sort");
		const orderParam  = url.searchParams.get("order")?.trim().toLowerCase();
		const sort  = sortParam ? sortParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;
		const order: 'asc' | 'desc' | undefined = orderParam === 'asc' ? 'asc' : orderParam === 'desc' ? 'desc' : undefined;

		// Admin sees all; author owner sees all their own drafts too
		const result = await new ArticleService(repository).listByAuthor(authorId, { page, limit, search, sort, order }, false);
		return Res.ok(result);
	}

	/**
	 * Public: get by slug or UUID id
	 */
	static async getBySlugOrId(c: Context<AppEnv>): Promise<Response> {
		const param = c.req.param('slug') ?? '';
		const service = new ArticleService(new ArticleRepository(c.env.DB));
		const article = UUID_RE.test(param)
			? await service.getById(param)
			: await service.getBySlug(param);
		if (!article) return Res.notFound();
		return Res.ok(article);
	}

	/**
	 * Authenticated: create article
	 */
	static async create(c: Context<AppEnv>): Promise<Response> {
		const repository = new ArticleRepository(c.env.DB);
		const body = await c.req.json().catch(() => null);
		if (!body || typeof body !== "object") return Res.badRequest("Invalid JSON body");

		const { title, slug, description } = body as Record<string, unknown>;
		if (!title || !slug || !description) {
			return Res.unprocessable("title, slug and description are required");
		}

		const user = c.get('user');
		try {
			const dto = body as Record<string, unknown>;
			const article = await new ArticleService(repository).create({
				title: dto.title as string,
				slug: dto.slug as string,
				description: dto.description as string,
				thumbnail: dto.thumbnail as string | undefined,
				content: dto.content as string | undefined,
				file_path: dto.file_path as string | undefined,
				published: dto.published as boolean | undefined,
				author_ids: dto.author_ids as number[] | undefined,
				tags: dto.tags as { tag: string; description?: string }[] | undefined,
				owner_id: user.sub,
			});
			return Res.created(article);
		} catch (err) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: articles.slug")) {
				return Res.conflict("An article with this slug already exists");
			}
			throw err;
		}
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
			if (err instanceof Error && err.message.includes("UNIQUE constraint failed: articles.slug")) {
				return Res.conflict("An article with this slug already exists");
			}
			throw err;
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
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');

		// Only owner or admin can add contributors
		const article = await c.env.DB
			.prepare('SELECT owner_id FROM articles WHERE id = ?1')
			.bind(id)
			.first<{ owner_id: string | null }>();

		if (!article) return Res.notFound();

		if (user.role !== 'admin' && article.owner_id !== user.sub) {
			return Res.forbidden();
		}

		const body = await c.req.json().catch(() => null);
		const userId = (body as Record<string, unknown>)?.user_id;
		if (!userId || typeof userId !== 'string') {
			return Res.unprocessable('user_id is required');
		}

		await new ArticleService(new ArticleRepository(c.env.DB)).addContributor(id, userId);
		return Res.created({ message: 'Contributor added' });
	}

	/**
	 * Authenticated: remove self as contributor
	 */
	static async removeSelfAsContributor(c: Context<AppEnv>): Promise<Response> {
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');

		const user = c.get('user');
		const removed = await new ArticleService(new ArticleRepository(c.env.DB)).removeContributor(id, user.sub);
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
