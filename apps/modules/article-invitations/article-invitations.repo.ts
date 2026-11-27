import type {
	ArticleInvitation,
	Contributor,
	InvitationRow,
	ReceivedInvitation,
} from './article-invitations.interface';

/** SQLite `datetime('now')` (UTC, no zone) -> ISO 8601 with `Z`, so clients don't read it as local time. */
function toIso(value: string): string {
	return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
}

export class ArticleInvitationRepository {
	constructor(private readonly db: D1Database) { }

	/**
	 * @description The article's owner, or null when it doesn't exist
	 * @param { string } articleId Article ID
	 * @returns { Promise<{ owner_id: string | null; title: string } | null> }
	 */
	findArticle(articleId: string): Promise<{ owner_id: string | null; title: string } | null> {
		return this.db
			.prepare('SELECT owner_id, title FROM articles WHERE id = ?1')
			.bind(articleId)
			.first<{ owner_id: string | null; title: string }>();
	}

	/**
	 * @description A user's current email (lower-cased), read from the DB rather than the JWT
	 * @param { string } userId User ID
	 * @returns { Promise<string | null> }
	 */
	async findUserEmail(userId: string): Promise<string | null> {
		const row = await this.db
			.prepare('SELECT lower(email) AS email FROM users WHERE id = ?1')
			.bind(userId)
			.first<{ email: string | null }>();
		return row?.email ?? null;
	}

	/**
	 * @description A user's display name
	 * @param { string } userId User ID
	 * @returns { Promise<string | null> }
	 */
	async findUserName(userId: string): Promise<string | null> {
		const row = await this.db.prepare('SELECT name FROM users WHERE id = ?1').bind(userId).first<{ name: string | null }>();
		return row?.name ?? null;
	}

	/**
	 * @description Invitations a user sent (or re-sent) in the last 24 hours, across all articles
	 * @param { string } userId Inviter's user ID
	 * @returns { Promise<number> }
	 */
	async countSentToday(userId: string): Promise<number> {
		const row = await this.db
			.prepare("SELECT COUNT(*) AS count FROM article_invitations WHERE invited_by = ?1 AND created_at >= datetime('now', '-1 day')")
			.bind(userId)
			.first<{ count: number }>();
		return row?.count ?? 0;
	}

	/**
	 * @description Contributors on an article
	 * @param { string } articleId Article ID
	 * @returns { Promise<Contributor[]> }
	 */
	async listContributors(articleId: string): Promise<Contributor[]> {
		const { results } = await this.db
			.prepare(
				'SELECT u.id, u.name, u.avatar FROM article_contributors ac JOIN users u ON u.id = ac.user_id WHERE ac.article_id = ?1 ORDER BY u.name COLLATE NOCASE',
			)
			.bind(articleId)
			.all<Contributor>();
		return results ?? [];
	}

	/**
	 * @description Whether an account with this email already contributes to the article
	 * @param { string } articleId Article ID
	 * @param { string } email Lower-cased email
	 * @returns { Promise<boolean> }
	 */
	async isContributorEmail(articleId: string, email: string): Promise<boolean> {
		const row = await this.db
			.prepare(
				'SELECT 1 AS one FROM article_contributors ac JOIN users u ON u.id = ac.user_id WHERE ac.article_id = ?1 AND lower(u.email) = ?2 LIMIT 1',
			)
			.bind(articleId, email)
			.first<{ one: number }>();
		return !!row;
	}

	/**
	 * @description Pending invitations on an article
	 * @param { string } articleId Article ID
	 * @returns { Promise<ArticleInvitation[]> }
	 */
	async listPending(articleId: string): Promise<ArticleInvitation[]> {
		const { results } = await this.db
			.prepare(
				"SELECT id, email, status, created_at FROM article_invitations WHERE article_id = ?1 AND status = 'pending' ORDER BY created_at DESC",
			)
			.bind(articleId)
			.all<Pick<InvitationRow, 'id' | 'email' | 'status' | 'created_at'>>();
		return (results ?? []).map((r) => ({ id: r.id, email: r.email, status: r.status, createdAt: toIso(r.created_at) }));
	}

	/**
	 * @description Count pending invitations on an article
	 * @param { string } articleId Article ID
	 * @returns { Promise<number> }
	 */
	async countPending(articleId: string): Promise<number> {
		const row = await this.db
			.prepare("SELECT COUNT(*) AS count FROM article_invitations WHERE article_id = ?1 AND status = 'pending'")
			.bind(articleId)
			.first<{ count: number }>();
		return row?.count ?? 0;
	}

	/**
	 * @description Create an invitation, or reopen a previous one for the same address
	 * @param { string } articleId Article ID
	 * @param { string } email Lower-cased email
	 * @param { string } invitedBy Inviter's user ID
	 * @returns { Promise<ArticleInvitation> }
	 */
	async upsert(articleId: string, email: string, invitedBy: string): Promise<ArticleInvitation> {
		const row = await this.db
			.prepare(
				`INSERT INTO article_invitations (article_id, email, invited_by, status, created_at, responded_at)
				 VALUES (?1, ?2, ?3, 'pending', datetime('now'), NULL)
				 ON CONFLICT(article_id, email) DO UPDATE SET
				   invited_by = excluded.invited_by, status = 'pending', created_at = excluded.created_at, responded_at = NULL
				 RETURNING id, email, status, created_at`,
			)
			.bind(articleId, email, invitedBy)
			.first<Pick<InvitationRow, 'id' | 'email' | 'status' | 'created_at'>>();
		return { id: row!.id, email: row!.email, status: row!.status, createdAt: toIso(row!.created_at) };
	}

	/**
	 * @description Revoke a pending invitation on an article
	 * @param { string } articleId Article ID
	 * @param { number } id Invitation ID
	 * @returns { Promise<boolean> } False when there was no such pending invitation
	 */
	async revoke(articleId: string, id: number): Promise<boolean> {
		const result = await this.db
			.prepare(
				"UPDATE article_invitations SET status = 'revoked', responded_at = datetime('now') WHERE id = ?1 AND article_id = ?2 AND status = 'pending'",
			)
			.bind(id, articleId)
			.run();
		return result.meta.changes > 0;
	}

	/**
	 * @description Pending invitations addressed to an email
	 * @param { string } email Lower-cased email
	 * @returns { Promise<ReceivedInvitation[]> }
	 */
	async listReceived(email: string): Promise<ReceivedInvitation[]> {
		const { results } = await this.db
			.prepare(
				`SELECT i.id, i.created_at, a.id AS article_id, a.title, a.slug, u.name AS inviter_name, u.avatar AS inviter_avatar
				 FROM article_invitations i
				 JOIN articles a ON a.id = i.article_id
				 LEFT JOIN users u ON u.id = i.invited_by
				 WHERE i.email = ?1 AND i.status = 'pending'
				 ORDER BY i.created_at DESC`,
			)
			.bind(email)
			.all<{
				id: number;
				created_at: string;
				article_id: string;
				title: string;
				slug: string;
				inviter_name: string | null;
				inviter_avatar: string | null;
			}>();
		return (results ?? []).map((r) => ({
			id: r.id,
			article: { id: r.article_id, title: r.title, slug: r.slug },
			invitedBy: r.inviter_name || r.inviter_avatar ? { name: r.inviter_name, avatar: r.inviter_avatar } : null,
			createdAt: toIso(r.created_at),
		}));
	}

	/**
	 * @description A pending invitation addressed to this email
	 * @param { number } id Invitation ID
	 * @param { string } email Lower-cased email
	 * @returns { Promise<InvitationRow | null> }
	 */
	findPendingFor(id: number, email: string): Promise<InvitationRow | null> {
		return this.db
			.prepare("SELECT * FROM article_invitations WHERE id = ?1 AND email = ?2 AND status = 'pending'")
			.bind(id, email)
			.first<InvitationRow>();
	}

	/**
	 * @description Accept: add the user as a contributor and close the invitation, atomically
	 * @param { InvitationRow } invitation The pending invitation
	 * @param { string } userId The accepting user's ID
	 * @returns { Promise<void> }
	 */
	async accept(invitation: InvitationRow, userId: string): Promise<void> {
		await this.db.batch([
			this.db
				.prepare('INSERT OR IGNORE INTO article_contributors (article_id, user_id) VALUES (?1, ?2)')
				.bind(invitation.article_id, userId),
			this.db
				.prepare("UPDATE article_invitations SET status = 'accepted', responded_at = datetime('now') WHERE id = ?1")
				.bind(invitation.id),
		]);
	}

	/**
	 * @description Decline a pending invitation
	 * @param { number } id Invitation ID
	 * @returns { Promise<void> }
	 */
	async decline(id: number): Promise<void> {
		await this.db
			.prepare("UPDATE article_invitations SET status = 'declined', responded_at = datetime('now') WHERE id = ?1")
			.bind(id)
			.run();
	}

	/**
	 * @description Remove a contributor from an article
	 * @param { string } articleId Article ID
	 * @param { string } userId Contributor's user ID
	 * @returns { Promise<boolean> } False when they weren't a contributor
	 */
	async removeContributor(articleId: string, userId: string): Promise<boolean> {
		const result = await this.db
			.prepare('DELETE FROM article_contributors WHERE article_id = ?1 AND user_id = ?2')
			.bind(articleId, userId)
			.run();
		return result.meta.changes > 0;
	}
}
