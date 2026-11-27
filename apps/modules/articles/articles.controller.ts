import type { Context, Next } from 'hono';
import { Res } from "../../shared/helpers/response";
import { isObject } from "../../shared/helpers/json";
import { parseListParams } from "../../shared/helpers/query";
import type { AppEnv, MineScope } from "./articles.interface";
import { ArticleRepository } from "./articles.repo";
import { ArticleService } from "./articles.service";
import { TagRepository } from "../tags/tags.repo";
import { TagService } from "../tags/tags.service";
import { getValidBody, validateRequired } from "../../shared/helpers/request";
import { parsePhnomPenhToUtc } from "../../shared/helpers/tz";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MINE_SCOPES: readonly MineScope[] = ['owned', 'contributing'];

/** Current publishing state, used to tell a real change from a re-sent value. */
type PublishState = { published: number; is_public: number; publish_at: string | null };

const PUBLISH_FORBIDDEN = 'Only an admin can publish. Submit the post for review instead.';

export class ArticlesController {

	/**
	 * @description Extract and validate UUID ID from request parameters
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { string | null } Validated UUID or null
	 */
	private static getParamId(c: Context<AppEnv>): string | null {
		const id = c.req.param('id') || '';
		return UUID_RE.test(id) ? id : null;
	}

	/**
	 * @description Retrieve the owner ID of an article
	 * @param { string } id The article ID
	 * @param { D1Database } db The database binding
	 * @returns { Promise<{ owner_id: string | null } | null> } The owner record or null
	 */
	private static async getArticleOwner(id: string, db: D1Database): Promise<{ owner_id: string | null } | null> {
		return db.prepare('SELECT owner_id FROM articles WHERE id = ?1').bind(id).first<{ owner_id: string | null }>();
	}

	/**
	 * @description Check if a user can manage contributors for an article
	 * @param { any } user The current user
	 * @param { string | null } ownerId The article owner ID
	 * @returns { boolean } True if allowed
	 */
	private static canManageContributors(user: any, ownerId: string | null): boolean {
		if (!user) return false;
		return user.role === 'admin' || user.sub === ownerId;
	}

	/**
	 * @description Middleware: resolve a :slug param to an article ID
	 * @param { Context<AppEnv> } c The Hono context
	 * @param { Next } next Next middleware function
	 * @returns { Promise<Response | void> }
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
	 * @description Middleware: resolve :id param and verify write access (owner | contributor | admin)
	 * @param { Context<AppEnv> } c The Hono context
	 * @param { Next } next Next middleware function
	 * @returns { Promise<Response | void> }
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

		const role = await ArticlesController.resolveArticleRole(id, user, article.owner_id, c.env.DB);
		if (!role) return Res.forbidden();

		c.set('articleId', id);
		c.set('articleRole', role);
		return next();
	};

	/**
	 * @description Resolve the caller's role on a specific article. Admin
	 * wins outright; otherwise owner match wins; else check the contributors
	 * table. Returns null when the caller has no access at all.
	 * @param { string } id The article ID
	 * @param { any } user The current user
	 * @param { string | null } ownerId The article owner ID
	 * @param { D1Database } db The database binding
	 * @returns { Promise<'owner' | 'contributor' | 'admin' | null> }
	 */
	private static async resolveArticleRole(
		id: string,
		user: any,
		ownerId: string | null,
		db: D1Database,
	): Promise<'owner' | 'contributor' | 'admin' | null> {
		if (!user) return null;
		if (user.role === 'admin') return 'admin';
		if (user.sub === ownerId) return 'owner';
		return (await new ArticleRepository(db).isContributor(id, user.sub)) ? 'contributor' : null;
	}

	/**
	 * @description Middleware: resolve :id param and verify delete access (owner | admin only)
	 * @param { Context<AppEnv> } c The Hono context
	 * @param { Next } next Next middleware function
	 * @returns { Promise<Response | void> }
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
	 * @description Authenticated: list articles.
	 *  - Non-admin: only `published=1 AND is_public=1`. `?status=` is ignored.
	 *  - Admin: sees all statuses. Filter with `?status=public,draft,queue,private` (comma-separated).
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Paginated list of articles
	 */
	static async list(c: Context<AppEnv>): Promise<Response> {
		const repository = new ArticleRepository(c.env.DB);
		const options = parseListParams(c.req.url);
		const user = c.get('user');
		const isAdmin = user?.role === 'admin';

		// Admin-only lazy self-heal (#32). The Cloudflare cron promotes
		// scheduled rows every 5 minutes in production; running it here on
		// every list previously made even a public reader trigger a write.
		// Keep it for admin dashboards so `wrangler dev` (no cron) still shows
		// a consistent view; regular list hits are read-only.
		if (isAdmin) {
			await repository.promoteScheduled().catch(() => { /* non-fatal — list still works */ });
		}

		const result = await new ArticleService(repository).list(options, true, { admin: isAdmin });
		return Res.ok(result);
	}

	/**
	 * @description Protected: list articles by authorId (includes drafts for owner/admin)
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Paginated list of author articles
	 */
	static async listByAuthor(c: Context<AppEnv>): Promise<Response> {
		const authorId = parseInt(c.req.param('authorId') ?? '', 10);
		if (isNaN(authorId) || authorId < 1) return Res.badRequest('Invalid author ID');

		const authorExists = await c.env.DB
			.prepare('SELECT 1 as one FROM authors WHERE id = ?1')
			.bind(authorId)
			.first<{ one: number }>();
		if (!authorExists) return Res.notFound('Author not found');

		// Row-level visibility (#19). Admins see everything; a signed-in
		// caller sees their own drafts + public rows; anyone else sees only
		// public rows. Ownership is decided by article.owner_id, NOT by which
		// author IDs happen to be linked to the caller — otherwise a
		// co-author on a draft they don't own would leak it.
		const user = c.get('user');
		const options = parseListParams(c.req.url);
		const result = await new ArticleService(new ArticleRepository(c.env.DB)).listByAuthor(
			authorId,
			options,
			{ admin: user?.role === 'admin', viewerUserId: user?.sub ?? null },
		);
		return Res.ok(result);
	}

	/**
	 * @description Public: get by slug or UUID id
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } The article and navigation data
	 */
	static async getBySlugOrId(c: Context<AppEnv>): Promise<Response> {
		const param = c.req.param('slug') ?? '';

		const repository = new ArticleRepository(c.env.DB);
		const service = new ArticleService(repository);
		const article = UUID_RE.test(param)
			? await service.getById(param)
			: await service.getBySlug(param);
		if (!article) return Res.notFound();
		if (article.status !== 'public' && !(await ArticlesController.canPreview(c, article.id, article.ownerId))) {
			return Res.notFound();
		}

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
	 * @description Whether the caller may read an article that isn't public
	 * (draft, in review, scheduled, private): an admin, its owner, or a
	 * contributor, signed in with a Bearer session. API keys never unlock
	 * unpublished posts, so a site key used by the public blog can't render a
	 * draft even if it belongs to an admin account.
	 * @param { Context<AppEnv> } c The Hono context (after optionalAuth)
	 * @param { string } id Article ID
	 * @param { string | null } ownerId Article owner ID
	 * @returns { Promise<boolean> }
	 */
	private static async canPreview(c: Context<AppEnv>, id: string, ownerId: string | null): Promise<boolean> {
		const user = c.get('user');
		if (!user || !c.req.header('Authorization')?.startsWith('Bearer ')) return false;
		return (await ArticlesController.resolveArticleRole(id, user, ownerId, c.env.DB)) !== null;
	}

	/**
	 * @description Normalise the request body before it reaches the repo. The
	 * API accepts both camelCase (public wire format) and snake_case (internal
	 * DTO format) for a handful of fields; this function collapses them to the
	 * snake_case shape the repo expects, and validates:
	 *   - `publishAt`/`publish_at`: parseable + converted to UTC ISO for storage.
	 *   - `isPublic`/`is_public`: boolean.
	 *   - `authorIds`/`author_ids`: array of numbers (silently dropped before
	 *     this normalisation existed — authors wouldn't attach on create).
	 * @param { any } body The raw request body
	 * @returns { Response | null } Error response if invalid, null otherwise (mutates body in place)
	 */
	private static normalizeArticleBody(body: any): Response | null {
		const rawPublishAt = body.publishAt ?? body.publish_at;
		if (rawPublishAt !== undefined && rawPublishAt !== null && rawPublishAt !== '') {
			const utc = parsePhnomPenhToUtc(String(rawPublishAt));
			if (!utc) return Res.unprocessable('publishAt must be a valid ISO or `YYYY-MM-DD HH:mm` Phnom_Penh timestamp');
			body.publish_at = utc;
		} else if (rawPublishAt === null || rawPublishAt === '') {
			body.publish_at = null;
		}
		delete body.publishAt;

		const rawIsPublic = body.isPublic ?? body.is_public;
		if (rawIsPublic !== undefined) {
			if (typeof rawIsPublic !== 'boolean') return Res.unprocessable('isPublic must be boolean');
			body.is_public = rawIsPublic;
		}
		delete body.isPublic;

		const rawAuthorIds = body.authorIds ?? body.author_ids;
		if (rawAuthorIds !== undefined) {
			if (!Array.isArray(rawAuthorIds) || rawAuthorIds.some((v) => typeof v !== 'number' || !Number.isInteger(v))) {
				return Res.unprocessable('authorIds must be an array of integers');
			}
			body.author_ids = rawAuthorIds;
		}
		delete body.authorIds;

		return null;
	}

	/**
	 * @description Publishing is admin-only. A non-admin may keep a post
	 * unpublished (or take their own post down) but may not make it public,
	 * schedule it, or attach authors. On update, re-sending the value the row
	 * already has is allowed so a full-form save of an approved post still
	 * works. Call after `normalizeArticleBody` (keys are snake_case by then).
	 * @param { any } body The normalized request body
	 * @param { PublishState | null } current The row's current state (null on create)
	 * @returns { Response | null } 403 response, or null when allowed
	 */
	private static rejectNonAdminPublishing(body: any, current: PublishState | null): Response | null {
		const wasPublished = current?.published === 1;
		const wasPublic = current?.is_public === 1;
		if (body.published === true && !wasPublished) return Res.forbidden(PUBLISH_FORBIDDEN);
		if (body.is_public === true && !wasPublic) return Res.forbidden(PUBLISH_FORBIDDEN);
		if (body.publish_at && body.publish_at !== (current?.publish_at ?? null)) return Res.forbidden(PUBLISH_FORBIDDEN);
		const authorIds = body.author_ids;
		if (Array.isArray(authorIds) && (current !== null || authorIds.length > 0)) {
			return Res.forbidden('Only an admin can set article authors.');
		}
		return null;
	}

	/**
	 * @description Authenticated: create article
	 * @method POST
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } The created article
	 */
	static async create(c: Context<AppEnv>): Promise<Response> {
		try {
			const body = await getValidBody<any>(c);
			validateRequired(body, ['title', 'slug', 'description']);

			const invalid = ArticlesController.normalizeArticleBody(body);
			if (invalid) return invalid;
			if (c.get('user')?.role !== 'admin') {
				const blocked = ArticlesController.rejectNonAdminPublishing(body, null);
				if (blocked) return blocked;
			}

			const repo = new ArticleRepository(c.env.DB);
			const article = await repo.create({ ...body, owner_id: c.get('user')?.sub } as any);
			return Res.created(article);
		} catch (err) {
			if (err instanceof Response) return err;
			return ArticlesController.handleSlugConflict(err);
		}
	}

	/**
	 * @description Handles slug conflict and validation errors thrown by the repo
	 * @param { unknown } err The error caught
	 * @returns { Response } Appropriate error response or re-throws
	 */
	private static handleSlugConflict(err: unknown): Response {
		if (err instanceof Error) {
			const status = (err as any).status;
			if (status === 422) return Res.unprocessable(err.message);
			if (err.message.includes("UNIQUE constraint failed: articles.slug")) {
				return Res.conflict("An article with this slug already exists");
			}
		}
		throw err;
	}

	/**
	 * @description Protected: update article (owner | contributor | admin)
	 * @method PUT/PATCH
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } The updated article
	 */
	static async update(c: Context<AppEnv>): Promise<Response> {
		const id = c.get('articleId'); // set by requireWriteAccess
		const role = c.get('articleRole'); // set by requireWriteAccess
		try {
			const body = await getValidBody<any>(c);

			// Field-level ACL (#20). Contributors may only edit editorial
			// content — never publishing / visibility fields, never the slug,
			// never the author or tag graph. Reject the request if they try;
			// silently dropping would be confusing when the API says 200 but
			// their change didn't apply.
			if (role === 'contributor') {
				const ALLOWED_CONTRIBUTOR_FIELDS = new Set(['content', 'description', 'thumbnail']);
				const rejected = Object.keys(body).filter((k) => !ALLOWED_CONTRIBUTOR_FIELDS.has(k));
				if (rejected.length > 0) {
					return Res.forbidden(`Contributors may only update: ${[...ALLOWED_CONTRIBUTOR_FIELDS].join(', ')}. Reserved: ${rejected.join(', ')}`);
				}
			}

			const invalid = ArticlesController.normalizeArticleBody(body);
			if (invalid) return invalid;
			if (role === 'owner') {
				const current = await c.env.DB
					.prepare('SELECT published, is_public, publish_at FROM articles WHERE id = ?1')
					.bind(id)
					.first<PublishState>();
				const blocked = ArticlesController.rejectNonAdminPublishing(body, current);
				if (blocked) return blocked;
			}
			const repo = new ArticleRepository(c.env.DB);
			const article = await new ArticleService(repo).update(id, body as never);
			if (!article) return Res.notFound();

			// Business rule: anyone who edits an article they didn't author is
			// recorded as a contributor. Authors (owner or otherwise) and
			// existing contributors are no-ops thanks to INSERT OR IGNORE and
			// the author-check inside the helper.
			const userId = c.get('user')?.sub;
			if (userId) await repo.ensureContributorIfNotAuthor(id, userId);

			return Res.ok(article);
		} catch (err) {
			if (err instanceof Response) return err;
			return ArticlesController.handleSlugConflict(err);
		}
	}

	/**
	 * @description Authenticated: the caller's own workspace — articles they
	 * own (`?scope=owned`, default) or contribute to (`?scope=contributing`),
	 * every status included. Accepts the usual search/status/sort/page params.
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Paginated list of articles
	 */
	static async listMine(c: Context<AppEnv>): Promise<Response> {
		const user = c.get('user');
		if (!user) return Res.unauthorized();
		const rawScope = new URL(c.req.url).searchParams.get('scope') ?? 'owned';
		if (!(MINE_SCOPES as readonly string[]).includes(rawScope)) {
			return Res.badRequest(`scope must be one of: ${MINE_SCOPES.join(', ')}`);
		}
		const result = await new ArticleRepository(c.env.DB).findMine(user.sub, rawScope as MineScope, parseListParams(c.req.url));
		return Res.ok(result);
	}

	/**
	 * @description Owner (or admin): submit a draft for admin review, or
	 * clear the request — the owner withdrawing it, or an admin declining it.
	 * Only unpublished articles can be in review.
	 * @method POST, DELETE
	 * @param { Context<AppEnv> } c The Hono context
	 * @param { boolean } requested True to submit, false to clear
	 * @returns { Promise<Response> } The updated article
	 */
	static async setReview(c: Context<AppEnv>, requested: boolean): Promise<Response> {
		const id = c.req.param('id') ?? '';
		if (!UUID_RE.test(id)) return Res.badRequest('Invalid article ID');
		const user = c.get('user');
		const row = await c.env.DB
			.prepare('SELECT owner_id, published FROM articles WHERE id = ?1')
			.bind(id)
			.first<{ owner_id: string | null; published: number }>();
		if (!row) return Res.notFound();
		if (user?.role !== 'admin' && user?.sub !== row.owner_id) return Res.forbidden();
		if (requested && row.published === 1) return Res.conflict('Article is already published');

		const repo = new ArticleRepository(c.env.DB);
		await repo.setReviewRequested(id, requested);
		return Res.ok(await repo.findById(id));
	}

	/**
	 * @description Protected: delete article (owner | admin)
	 * @method DELETE
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } No content response
	 */
	static async delete(c: Context<AppEnv>): Promise<Response> {
		const id = c.get('articleId'); // set by requireDeleteAccess
		const deleted = await new ArticleService(new ArticleRepository(c.env.DB)).delete(id);
		if (!deleted) return Res.notFound();
		return Res.noContent();
	}

	/**
	 * @description Protected: add contributor (owner | admin)
	 * @method POST
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } Success message
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

	/**
	 * @description Handles contributor addition errors
	 * @param { unknown } err The error caught
	 * @returns { Response } Conflict response or throws
	 */
	private static handleContributorError(err: unknown): Response {
		if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
			return Res.conflict("User is already a contributor");
		}
		throw err;
	}

	/**
	 * @description Authenticated: remove self as contributor
	 * @method DELETE
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } No content response
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
	 * @description Public: get article tags
	 * @method GET
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<Response> } List of tags
	 */
	static async getTagsArticle(c: Context<AppEnv>): Promise<Response> {
		const tags = await new TagService(new TagRepository(c.env.DB)).listByArticle(c.get('articleId'));
		return Res.ok(tags);
	}

	/**
	 * @description Admin: replace the article display order.
	 * @method PUT
	 * @body `{ ids: string[] }` — article ids in the desired order
	 * @returns { Promise<Response> } `{ updated: number }`
	 */
	static async reorder(c: Context<AppEnv>): Promise<Response> {
		if (c.get('user')?.role !== 'admin') return Res.forbidden();

		const body = await c.req.json().catch(() => null);
		const raw = (body as any)?.ids ?? (body as any)?.article_ids;
		if (!Array.isArray(raw)) return Res.unprocessable('ids must be an array of article ids');
		for (const id of raw) {
			if (typeof id !== 'string' || !UUID_RE.test(id)) {
				return Res.unprocessable('ids must contain valid article UUIDs');
			}
		}

		const updated = await new ArticleService(new ArticleRepository(c.env.DB)).reorder(raw);
		return Res.ok({ updated });
	}
}
