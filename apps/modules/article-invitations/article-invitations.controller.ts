import type { Context } from 'hono';
import { Res } from '../../shared/helpers/response';
import { isObject } from '../../shared/helpers/json';
import { ArticleInvitationRepository } from './article-invitations.repo';
import type { AppEnv } from './article-invitations.interface';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_RE = /^\d{1,12}$/;
// Deliberately loose: one @, something on both sides, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
/** Keeps one article from being used to fan out invitations. */
export const MAX_PENDING_INVITATIONS = 20;

type ManageResult = { repo: ArticleInvitationRepository; articleId: string; ownerId: string | null } | Response;

/**
 * Owners invite people by email to contribute to their article; the invitee
 * accepts or declines from their own workspace. No email is sent: an API that
 * mails arbitrary addresses on behalf of any signed-up account is a spam
 * relay. Invitations are matched to the invitee by their account email, which
 * is verified (email sign-up OTP, or the provider's verified address).
 */
export class ArticleInvitationsController {

	/**
	 * @description Resolve `:id` and require the caller to be the article's owner or an admin
	 * @param { Context<AppEnv> } c The Hono context
	 * @returns { Promise<ManageResult> }
	 */
	private static async requireManager(c: Context<AppEnv>): Promise<ManageResult> {
		const articleId = c.req.param('id') ?? '';
		if (!UUID_RE.test(articleId)) return Res.badRequest('Invalid article ID');
		const repo = new ArticleInvitationRepository(c.env.DB);
		const article = await repo.findArticle(articleId);
		if (!article) return Res.notFound();
		const user = c.get('user');
		if (user?.role !== 'admin' && user?.sub !== article.owner_id) return Res.forbidden();
		return { repo, articleId, ownerId: article.owner_id };
	}

	/**
	 * @description Owner/admin: contributors and pending invitations on an article
	 * @method GET
	 * @returns { Promise<Response> } `{ contributors, invitations }`
	 */
	static async listForArticle(c: Context<AppEnv>): Promise<Response> {
		const ctx = await ArticleInvitationsController.requireManager(c);
		if (ctx instanceof Response) return ctx;
		const [contributors, invitations] = await Promise.all([
			ctx.repo.listContributors(ctx.articleId),
			ctx.repo.listPending(ctx.articleId),
		]);
		return Res.ok({ contributors, invitations });
	}

	/**
	 * @description Owner/admin: invite an email address to contribute. Re-inviting
	 * an address reopens its earlier invitation.
	 * @method POST
	 * @body `{ email: string }`
	 * @returns { Promise<Response> } 201 with the invitation
	 */
	static async invite(c: Context<AppEnv>): Promise<Response> {
		const ctx = await ArticleInvitationsController.requireManager(c);
		if (ctx instanceof Response) return ctx;

		const body = await c.req.json().catch(() => null);
		const raw = isObject(body) ? (body as Record<string, unknown>).email : undefined;
		const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
		if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
			return Res.unprocessable('Enter a valid email address');
		}

		const ownerEmail = ctx.ownerId ? await ctx.repo.findUserEmail(ctx.ownerId) : null;
		if (email === ownerEmail) return Res.unprocessable('That address belongs to the article owner');
		if (await ctx.repo.isContributorEmail(ctx.articleId, email)) {
			return Res.conflict('That person already contributes to this article');
		}
		if ((await ctx.repo.countPending(ctx.articleId)) >= MAX_PENDING_INVITATIONS) {
			return Res.unprocessable(`An article can have at most ${MAX_PENDING_INVITATIONS} pending invitations`);
		}

		const invitation = await ctx.repo.upsert(ctx.articleId, email, c.get('user')!.sub);
		return Res.created(invitation);
	}

	/**
	 * @description Owner/admin: revoke a pending invitation
	 * @method DELETE
	 * @returns { Promise<Response> } 204
	 */
	static async revoke(c: Context<AppEnv>): Promise<Response> {
		const ctx = await ArticleInvitationsController.requireManager(c);
		if (ctx instanceof Response) return ctx;
		const id = c.req.param('invitationId') ?? '';
		if (!ID_RE.test(id)) return Res.badRequest('Invalid invitation ID');
		if (!(await ctx.repo.revoke(ctx.articleId, Number(id)))) return Res.notFound('Invitation not found');
		return Res.noContent();
	}

	/**
	 * @description Owner/admin: remove a contributor from the article
	 * @method DELETE
	 * @returns { Promise<Response> } 204
	 */
	static async removeContributor(c: Context<AppEnv>): Promise<Response> {
		const ctx = await ArticleInvitationsController.requireManager(c);
		if (ctx instanceof Response) return ctx;
		const userId = c.req.param('userId') ?? '';
		if (!userId || userId.length > 128) return Res.badRequest('Invalid user ID');
		if (!(await ctx.repo.removeContributor(ctx.articleId, userId))) return Res.notFound('Not a contributor');
		return Res.noContent();
	}

	/**
	 * @description Signed-in user: pending invitations addressed to their email
	 * @method GET
	 * @returns { Promise<Response> } `{ data: ReceivedInvitation[] }`
	 */
	static async listReceived(c: Context<AppEnv>): Promise<Response> {
		const repo = new ArticleInvitationRepository(c.env.DB);
		const email = await repo.findUserEmail(c.get('user')!.sub);
		return Res.ok({ data: email ? await repo.listReceived(email) : [] });
	}

	/**
	 * @description Signed-in user: accept or decline an invitation addressed to
	 * them. Anything else (someone else's, already answered) is a 404 so IDs
	 * can't be probed.
	 * @method POST
	 * @param { boolean } accept True to accept, false to decline
	 * @returns { Promise<Response> } Accept: `{ articleId, slug }`; decline: 204
	 */
	static async respond(c: Context<AppEnv>, accept: boolean): Promise<Response> {
		const id = c.req.param('invitationId') ?? '';
		if (!ID_RE.test(id)) return Res.badRequest('Invalid invitation ID');
		const user = c.get('user')!;
		const repo = new ArticleInvitationRepository(c.env.DB);
		const email = await repo.findUserEmail(user.sub);
		const invitation = email ? await repo.findPendingFor(Number(id), email) : null;
		if (!invitation) return Res.notFound('Invitation not found');

		if (!accept) {
			await repo.decline(invitation.id);
			return Res.noContent();
		}
		await repo.accept(invitation, user.sub);
		const article = await c.env.DB
			.prepare('SELECT slug FROM articles WHERE id = ?1')
			.bind(invitation.article_id)
			.first<{ slug: string }>();
		return Res.ok({ articleId: invitation.article_id, slug: article?.slug ?? null });
	}
}
