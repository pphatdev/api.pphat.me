import type { User, IAuthRepository, ApiKeyRecord, ApiKeyLookup } from './auth.interface';

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
	 * @description Find a user by their UUID
	 * @param { string } id User ID
	 * @returns { Promise<User | null> } User record or null
	 */
	async findUserById(id: string): Promise<User | null> {
		return this.db
			.prepare('SELECT * FROM users WHERE id = ?1')
			.bind(id)
			.first<User>();
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
	 * @description Verify an OTP and mark it as used
	 * @param { string } email User email
	 * @param { string } code The OTP code
	 * @returns { Promise<boolean> } True if valid and consumed
	 */
	async verifyAndConsumeOtp(email: string, code: string): Promise<boolean> {
		const otp = await this.db
			.prepare(
				"SELECT id FROM email_otps WHERE email = ?1 AND code = ?2 AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
			)
			.bind(email, code)
			.first<{ id: string }>();

		if (!otp) return false;

		await this.db
			.prepare('UPDATE email_otps SET used = 1 WHERE id = ?1')
			.bind(otp.id)
			.run();

		return true;
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
	 * @description Save a new refresh token
	 * @param { string } userId User ID
	 * @param { string } token The refresh token
	 * @param { string } expiresAt Expiry timestamp
	 * @returns { Promise<void> }
	 */
	async saveRefreshToken(userId: string, token: string, expiresAt: string): Promise<void> {
		const id = crypto.randomUUID();
		await this.db
			.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?1, ?2, ?3, ?4)')
			.bind(id, userId, token, expiresAt)
			.run();
	}

	/**
	 * @description Find a refresh token record
	 * @param { string } token The refresh token
	 * @returns { Promise<{ user_id: string; expires_at: string } | null> } Token record or null
	 */
	async findRefreshToken(token: string): Promise<{ user_id: string; expires_at: string } | null> {
		return this.db
			.prepare('SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?1')
			.bind(token)
			.first<{ user_id: string; expires_at: string }>();
	}

	/**
	 * @description Delete a refresh token
	 * @param { string } token The refresh token to delete
	 * @returns { Promise<void> }
	 */
	async deleteRefreshToken(token: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM refresh_tokens WHERE token = ?1')
			.bind(token)
			.run();
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
