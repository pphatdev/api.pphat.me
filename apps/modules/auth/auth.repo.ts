import type { User, IAuthRepository } from './auth.interface';

export class AuthRepository implements IAuthRepository {
	constructor(private readonly db: D1Database) { }

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

	async findUserById(id: string): Promise<User | null> {
		return this.db
			.prepare('SELECT * FROM users WHERE id = ?1')
			.bind(id)
			.first<User>();
	}

	async findEmailUser(email: string): Promise<User | null> {
		return this.db
			.prepare("SELECT * FROM users WHERE provider = 'email' AND provider_id = ?1")
			.bind(email)
			.first<User>();
	}

	async createEmailUser(email: string, name: string, passwordHash: string): Promise<User> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		await this.db
			.prepare('INSERT INTO users (id, provider, provider_id, email, name, avatar, email_verified, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)')
			.bind(id, 'email', email, email, name, null, passwordHash)
			.run();
		return { id, provider: 'email', provider_id: email, email, name, avatar: null, role: 'user', email_verified: 0, password_hash: passwordHash, created_at: now, updated_at: now };
	}

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

	async invalidateUserOtps(email: string): Promise<void> {
		await this.db
			.prepare("UPDATE email_otps SET used = 1 WHERE email = ?1 AND used = 0")
			.bind(email)
			.run();
	}

	async markEmailVerified(email: string): Promise<void> {
		await this.db
			.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE provider = 'email' AND provider_id = ?1")
			.bind(email)
			.run();
	}

	async saveRefreshToken(userId: string, token: string, expiresAt: string): Promise<void> {
		const id = crypto.randomUUID();
		await this.db
			.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?1, ?2, ?3, ?4)')
			.bind(id, userId, token, expiresAt)
			.run();
	}

	async findRefreshToken(token: string): Promise<{ user_id: string; expires_at: string } | null> {
		return this.db
			.prepare('SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?1')
			.bind(token)
			.first<{ user_id: string; expires_at: string }>();
	}

	async deleteRefreshToken(token: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM refresh_tokens WHERE token = ?1')
			.bind(token)
			.run();
	}

	async deleteUserRefreshTokens(userId: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM refresh_tokens WHERE user_id = ?1')
			.bind(userId)
			.run();
	}
}
