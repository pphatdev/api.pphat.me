import type { JwtPayload } from '../auth/auth.interface';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/** Owner/admin view of an invitation on one of their articles. */
export interface ArticleInvitation {
	id: number;
	email: string;
	status: InvitationStatus;
	createdAt: string;
}

/** Invitee view: what they were invited to and by whom. */
export interface ReceivedInvitation {
	id: number;
	article: { id: string; title: string; slug: string };
	invitedBy: { name: string | null; avatar: string | null } | null;
	createdAt: string;
}

/** A contributor as the article owner sees them (no email: they may not have been invited by email). */
export interface Contributor {
	id: string;
	name: string | null;
	avatar: string | null;
}

export interface InvitationRow {
	id: number;
	article_id: string;
	email: string;
	invited_by: string | null;
	status: InvitationStatus;
	created_at: string;
	responded_at: string | null;
}

export type AppEnv = {
	Bindings: Env;
	Variables: { user?: JwtPayload };
};
