import { Hono } from 'hono';
import { authGuard } from '../../middlewares/auth.middleware';
import { ArticleInvitationsController } from './article-invitations.controller';
import type { AppEnv } from './article-invitations.interface';

const app = new Hono<AppEnv>();

/**
 * @description Contributors and pending invitations on an article (owner | admin)
 * @method GET
 * @param { String } id Article ID (UUID)
 */
app.get('/v1/api/articles/:id/contributors', authGuard, ArticleInvitationsController.listForArticle);

/**
 * @description Invite someone by email to contribute (owner | admin)
 * @method POST
 * @param { String } id Article ID (UUID)
 * @body `{ email: string }`
 */
app.post('/v1/api/articles/:id/invitations', authGuard, ArticleInvitationsController.invite);

/**
 * @description Revoke a pending invitation (owner | admin)
 * @method DELETE
 * @param { String } id Article ID (UUID)
 * @param { Number } invitationId Invitation ID
 */
app.delete('/v1/api/articles/:id/invitations/:invitationId', authGuard, ArticleInvitationsController.revoke);

/**
 * @description Remove a contributor (owner | admin). `/contributors/me`
 * (leave as a contributor) is registered earlier in articleRoutes and wins.
 * @method DELETE
 * @param { String } id Article ID (UUID)
 * @param { String } userId Contributor's user ID
 */
app.delete('/v1/api/articles/:id/contributors/:userId', authGuard, ArticleInvitationsController.removeContributor);

/**
 * @description Pending invitations for the signed-in user's email
 * @method GET
 */
app.get('/v1/api/invitations', authGuard, ArticleInvitationsController.listReceived);

/**
 * @description Accept an invitation (become a contributor)
 * @method POST
 * @param { Number } invitationId Invitation ID
 */
app.post('/v1/api/invitations/:invitationId/accept', authGuard, (c) => ArticleInvitationsController.respond(c, true));

/**
 * @description Decline an invitation
 * @method POST
 * @param { Number } invitationId Invitation ID
 */
app.post('/v1/api/invitations/:invitationId/decline', authGuard, (c) => ArticleInvitationsController.respond(c, false));

export { app as articleInvitationRoutes };
