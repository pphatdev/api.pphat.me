import type { User, PublicUser, IAuthRepository, ApiKeyRecord, ApiKeyLookup, RefreshTokenRow } from './auth.interface';

export class AuthRepository implements IAuthRepository {
	constructor(private readonly db: D1Database) { }

	/**
	 * @description Find an existing user by provider or create a new one
	 * @param { string } provider OAuth provider name
	 * @param { string } providerId ID from provider
	 * @param { object } data User profile data
	 * @returns { Promise<User> } The user record
	 */
	async findOrCreateUser(
		provider: string,
		providerId: string,
		data: { email: string | null; name: string | null; avatar: string | null },
	): Promise<User> {
		const existing = await this.db
			.prepare('SELECT * FROM users WHERE provider = ?1 AND provider_id = ?2')
			.bind(provider, providerId)
			.first<User>();

		if (existing) {
			await this.db
				.prepare("UPDATE users SET email = ?1, name = ?2, avatar = ?3, updated_at = datetime('now') WHERE id = ?4")
				.bind(data.email, data.name, data.avatar, existing.id)
				.run();
			return { ...existing, ...data };
		}

		const id = crypto.randomUUID();
		await this.db
			.prepare('INSERT INTO users (id, provider, provider_id, email, name, avatar) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
			.bind(id, provider, providerId, data.email, data.name, data.avatar)
			.run();

		return {
			id,
			provider: provider as 'github' | 'google' | 'email',
			provider_id: providerId,
			email: data.email,
			name: data.name,
			avatar: data.avatar,
			role: 'user',
			email_verified: 0,
			password_hash: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
	}

	/**
	 * @description Find a user by their UUID (internal use only — includes password_hash)
	 * @param { string } id User ID
	 * @returns { Promise<User | null> } User record or null
	 */
	async findUserById(id: string): Promise<User | null> {
		return this.db
			.prepare('SELECT id, provider, provider_id, email, name, avatar, email_verified, password_hash, role, created_at, updated_at FROM users WHERE id = ?1')
			.bind(id)
			.first<User>();
	}

	/**
	 * @description Find a user by their UUID, safe to return to clients (no password_hash, no provider_id)
	 * @param { string } id User ID
	 * @returns { Promise<PublicUser | null> } Public user record or null
	 */
	async findPublicUserById(id: string): Promise<PublicUser | null> {
		return this.db
			.prepare('SELECT id, provider, email, name, avatar, email_verified, role, created_at, updated_at FROM users WHERE id = ?1')
			.bind(id)
			.first<PublicUser>();
	}

	/**
	 * @description Find a user by their email
	 * @param { string } email User email
	 * @returns { Promise<User | null> } User record or null
	 */
	async findEmailUser(email: string): Promise<User | null> {
		return this.db
			.prepare("SELECT * FROM users WHERE provider = 'email' AND provider_id = ?1")
			.bind(email)
			.first<User>();
	}

	/**
	 * @description Create a new email-based user
	 * @param { string } email User email
	 * @param { string } name User name
	 * @param { string } passwordHash Hashed password
	 * @returns { Promise<User> } The created user
	 */
	async createEmailUser(email: string, name: string, passwordHash: string): Promise<User> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		await this.db
			.prepare('INSERT INTO users (id, provider, provider_id, email, name, avatar, email_verified, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)')
			.bind(id, 'email', email, email, name, null, passwordHash)
			.run();
		return { id, provider: 'email', provider_id: email, email, name, avatar: null, role: 'user', email_verified: 0, password_hash: passwordHash, created_at: now, updated_at: now };
	}

	/**
	 * @description Replace a user's stored `password_hash`. Used by the
	 * opportunistic PBKDF2 upgrade path on login (#36).
	 * @param { string } userId User ID
	 * @param { string } passwordHash New hash string
	 * @returns { Promise<void> }
	 */
	async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
		await this.db
			.prepare("UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE id = ?2")
			.bind(passwordHash, userId)
			.run();
	}

	/**
	 * @description Create a new verification OTP
	 * @param { string } email User email
	 * @param { string } code The OTP code
	 * @param { string } expiresAt Expiry timestamp
	 * @returns { Promise<void> }
	 */
	async createOtp(email: string, code: string, expiresAt: string): Promise<void> {
		// Invalidate any previous unused OTPs for this email first
		await this.db
			.prepare("UPDATE email_otps SET used = 1 WHERE email = ?1 AND used = 0")
			.bind(email)
			.run();
		const id = crypto.randomUUID();
		await this.db
			.prepare('INSERT INTO email_otps (id, email, code, expires_at) VALUES (?1, ?2, ?3, ?4)')
			.bind(id, email, code, expiresAt)
			.run();
	}

	/**
	 * @description Verify an OTP and either mark it consumed on success or
	 * increment the attempt counter on failure. Invalidates the OTP once the
	 * attempt cap is reached so brute-force windows are bounded.
	 * @param { string } email User email
	 * @param { string } code The OTP code
	 * @param { number } [maxAttempts=5] Attempts allowed before the OTP is invalidated
	 * @returns { Promise<boolean> } True if valid and consumed
	 */
	async verifyAndConsumeOtp(email: string, code: string, maxAttempts = 5): Promise<boolean> {
		// Load the most recent unused, unexpired OTP for this email
		const otp = await this.db
			.prepare(
				"SELECT id, code, attempts FROM email_otps WHERE email = ?1 AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
			)
			.bind(email)
			.first<{ id: string; code: string; attempts: number }>();

		if (!otp) return false;

		if (otp.code === code) {
			await this.db
				.prepare('UPDATE email_otps SET used = 1 WHERE id = ?1')
				.bind(otp.id)
				.run();
			return true;
		}

		// Wrong code — increment attempts and, on the cap, invalidate the OTP so
		// further guesses cannot use it even if the client keeps trying.
		const nextAttempts = (otp.attempts ?? 0) + 1;
		if (nextAttempts >= maxAttempts) {
			await this.db
				.prepare('UPDATE email_otps SET attempts = ?1, used = 1 WHERE id = ?2')
				.bind(nextAttempts, otp.id)
				.run();
		} else {
			await this.db
				.prepare('UPDATE email_otps SET attempts = ?1 WHERE id = ?2')
				.bind(nextAttempts, otp.id)
				.run();
		}
		return false;
	}

	/**
	 * @description Mark a user's email as verified
	 * @param { string } email User email
	 * @returns { Promise<void> }
	 */
	async markEmailVerified(email: string): Promise<void> {
		await this.db
			.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE provider = 'email' AND provider_id = ?1")
			.bind(email)
			.run();
	}

	/**
	 * @description Save a new refresh token (as SHA-256 hash). Every token
	 * belongs to a family — rotation keeps the same family_id so that reuse of
	 * any consumed token in the family can revoke the whole line.
	 * @param { string } userId User ID
	 * @param { string } familyId Family identifier (shared across rotations)
	 * @param { string } tokenHash SHA-256 hex hash of the raw token
	 * @param { string } expiresAt Expiry timestamp
	 * @returns { Promise<void> }
	 */
	async saveRefreshToken(userId: string, familyId: string, tokenHash: string, expiresAt: string): Promise<void> {
		const id = crypto.randomUUID();
		await this.db
			.prepare('INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)')
			.bind(id, userId, familyId, tokenHash, expiresAt)
			.run();
	}

	/**
	 * @description Find a refresh token record by hash.
	 * @param { string } tokenHash SHA-256 hex hash of the raw token
	 * @returns { Promise<RefreshTokenRow | null> } Row or null
	 */
	async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
		return this.db
			.prepare('SELECT user_id, family_id, expires_at, consumed_at FROM refresh_tokens WHERE token_hash = ?1')
			.bind(tokenHash)
			.first<RefreshTokenRow>();
	}

	/**
	 * @description Mark a refresh token as consumed (rotated). The row remains
	 * so that reuse detection can still match it and trigger family revocation.
	 * @param { string } tokenHash SHA-256 hex hash of the raw token
	 * @returns { Promise<void> }
	 */
	async markRefreshTokenConsumed(tokenHash: string): Promise<void> {
		await this.db
			.prepare("UPDATE refresh_tokens SET consumed_at = datetime('now') WHERE token_hash = ?1 AND consumed_at IS NULL")
			.bind(tokenHash)
			.run();
	}

	/**
	 * @description Hard-delete a refresh token row (used by logout).
	 * @param { string } tokenHash SHA-256 hex hash of the raw token
	 * @returns { Promise<void> }
	 */
	async deleteRefreshTokenByHash(tokenHash: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?1')
			.bind(tokenHash)
			.run();
	}

	/**
	 * @description Revoke every token in a family (reuse detection).
	 * @param { string } familyId Family identifier
	 * @returns { Promise<void> }
	 */
	async revokeRefreshTokenFamily(familyId: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM refresh_tokens WHERE family_id = ?1')
			.bind(familyId)
			.run();
	}

	/**
	 * @description Sweep rows whose `expires_at` is past. Cheap enough to call
	 * on every refresh/logout so the table does not grow unboundedly.
	 * @returns { Promise<void> }
	 */
	async deleteExpiredRefreshTokens(): Promise<void> {
		await this.db
			.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')")
			.run();
	}

	/**
	 * @description Set the access-token invalidation floor for a user to "now".
	 * Any access JWT with `iat` earlier than this is rejected by authGuard.
	 * @param { string } userId User ID
	 * @returns { Promise<void> }
	 */
	async invalidateUserSessions(userId: string): Promise<void> {
		await this.db
			.prepare("UPDATE users SET session_invalidated_at = datetime('now') WHERE id = ?1")
			.bind(userId)
			.run();
	}

	/**
	 * @description Read the access-token invalidation floor as a Unix
	 * timestamp (seconds). Returns null when the user has never invalidated
	 * a session (never logged out), letting authGuard skip the comparison.
	 * @param { string } userId User ID
	 * @returns { Promise<number | null> } Unix seconds, or null
	 */
	async getSessionInvalidatedAt(userId: string): Promise<number | null> {
		const row = await this.db
			.prepare('SELECT session_invalidated_at as t FROM users WHERE id = ?1')
			.bind(userId)
			.first<{ t: string | null }>();
		if (!row?.t) return null;
		const ms = Date.parse(row.t.includes('T') ? row.t : row.t.replace(' ', 'T') + 'Z');
		return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
	}

	/**
	 * @description Persist a new API key record (only the hash is stored)
	 * @param { string } id Key ID (UUID)
	 * @param { string } userId Owning user ID
	 * @param { string } name Human-readable label
	 * @param { string } prefix First characters of the plaintext key (for identification)
	 * @param { string } keyHash SHA-256 hex hash of the plaintext key
	 * @param { string | null } expiresAt ISO timestamp or null for no expiry
	 * @returns { Promise<ApiKeyRecord> } The stored record (without the plaintext)
	 */
	async createApiKey(
		id: string,
		userId: string,
		name: string,
		prefix: string,
		keyHash: string,
		expiresAt: string | null,
	): Promise<ApiKeyRecord> {
		const now = new Date().toISOString();
		await this.db
			.prepare('INSERT INTO api_keys (id, user_id, name, prefix, key_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
			.bind(id, userId, name, prefix, keyHash, expiresAt)
			.run();
		return {
			id,
			user_id: userId,
			name,
			prefix,
			last_used_at: null,
			expires_at: expiresAt,
			revoked_at: null,
			created_at: now,
		};
	}

	/**
	 * @description List API keys belonging to a user (metadata only)
	 * @param { string } userId User ID
	 * @returns { Promise<ApiKeyRecord[]> } Non-secret key records
	 */
	async listApiKeysByUser(userId: string): Promise<ApiKeyRecord[]> {
		const { results } = await this.db
			.prepare('SELECT id, user_id, name, prefix, last_used_at, expires_at, revoked_at, created_at FROM api_keys WHERE user_id = ?1 ORDER BY created_at DESC')
			.bind(userId)
			.all<ApiKeyRecord>();
		return results ?? [];
	}

	/**
	 * @description Look up an API key by its hash
	 * @param { string } keyHash SHA-256 hex hash
	 * @returns { Promise<ApiKeyLookup | null> } Minimal record for guard checks or null
	 */
	async findApiKeyByHash(keyHash: string): Promise<ApiKeyLookup | null> {
		return this.db
			.prepare('SELECT id, user_id, expires_at, revoked_at FROM api_keys WHERE key_hash = ?1')
			.bind(keyHash)
			.first<ApiKeyLookup>();
	}

	/**
	 * @description Revoke an API key owned by the given user
	 * @param { string } id Key ID
	 * @param { string } userId Owning user ID
	 * @returns { Promise<boolean> } True if a row was updated
	 */
	async revokeApiKey(id: string, userId: string): Promise<boolean> {
		const res = await this.db
			.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL")
			.bind(id, userId)
			.run();
		return (res.meta?.changes ?? 0) > 0;
	}

	/**
	 * @description Update the last-used timestamp for an API key
	 * @param { string } id Key ID
	 * @returns { Promise<void> }
	 */
	async touchApiKeyLastUsed(id: string): Promise<void> {
		await this.db
			.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?1")
			.bind(id)
			.run();
	}
}
