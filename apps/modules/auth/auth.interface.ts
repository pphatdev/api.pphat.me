export interface User {
	id: string;
	provider: 'github' | 'google' | 'email';
	provider_id: string;
	email: string | null;
	name: string | null;
	avatar: string | null;
	email_verified: number;
	password_hash: string | null;
	role: 'user' | 'admin';
	created_at: string;
	updated_at: string;
}

export type PublicUser = Omit<User, 'password_hash' | 'provider_id'>;

export interface JwtPayload {
	sub: string;
	provider: string;
	email: string | null;
	name: string | null;
	role: 'user' | 'admin';
	type?: 'access' | 'refresh';
	iat: number;
	exp: number;
}

export interface GitHubUser {
	id: number;
	login: string;
	name: string | null;
	email: string | null;
	avatar_url: string;
}

export interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
}

export interface GoogleUser {
	id: string;
	email: string;
	name: string;
	picture: string;
}

export interface RefreshTokenRow {
	user_id: string;
	family_id: string;
	expires_at: string;
	consumed_at: string | null;
}

export interface ApiKeyRecord {
	id: string;
	user_id: string;
	name: string;
	prefix: string;
	last_used_at: string | null;
	expires_at: string | null;
	revoked_at: string | null;
	created_at: string;
}

export interface ApiKeyLookup {
	id: string;
	user_id: string;
	expires_at: string | null;
	revoked_at: string | null;
}

export interface IAuthRepository {
	findOrCreateUser(
		provider: string,
		providerId: string,
		data: { email: string | null; name: string | null; avatar: string | null },
	): Promise<User>;
	findUserById(id: string): Promise<User | null>;
	findPublicUserById(id: string): Promise<PublicUser | null>;
	findEmailUser(email: string): Promise<User | null>;
	createEmailUser(email: string, name: string, passwordHash: string): Promise<User>;
	createOtp(email: string, code: string, expiresAt: string): Promise<void>;
	verifyAndConsumeOtp(email: string, code: string): Promise<boolean>;
	markEmailVerified(email: string): Promise<void>;

	// Refresh Tokens (stored as sha256 hash + family_id for reuse detection)
	saveRefreshToken(userId: string, familyId: string, tokenHash: string, expiresAt: string): Promise<void>;
	findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
	markRefreshTokenConsumed(tokenHash: string): Promise<void>;
	deleteRefreshTokenByHash(tokenHash: string): Promise<void>;
	revokeRefreshTokenFamily(familyId: string): Promise<void>;
	deleteExpiredRefreshTokens(): Promise<void>;

	// Access-token invalidation floor. authGuard compares JWT.iat against this
	// timestamp; anything issued before it is rejected. Written on logout.
	invalidateUserSessions(userId: string): Promise<void>;
	getSessionInvalidatedAt(userId: string): Promise<number | null>;

	// API Keys (SSO)
	createApiKey(id: string, userId: string, name: string, prefix: string, keyHash: string, expiresAt: string | null): Promise<ApiKeyRecord>;
	listApiKeysByUser(userId: string): Promise<ApiKeyRecord[]>;
	findApiKeyByHash(keyHash: string): Promise<ApiKeyLookup | null>;
	revokeApiKey(id: string, userId: string): Promise<boolean>;
	touchApiKeyLastUsed(id: string): Promise<void>;
}
