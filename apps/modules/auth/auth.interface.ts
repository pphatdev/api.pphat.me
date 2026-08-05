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
	findEmailUser(email: string): Promise<User | null>;
	createEmailUser(email: string, name: string, passwordHash: string): Promise<User>;
	createOtp(email: string, code: string, expiresAt: string): Promise<void>;
	verifyAndConsumeOtp(email: string, code: string): Promise<boolean>;
	markEmailVerified(email: string): Promise<void>;

	// Refresh Tokens
	saveRefreshToken(userId: string, token: string, expiresAt: string): Promise<void>;
	findRefreshToken(token: string): Promise<{ user_id: string; expires_at: string } | null>;
	deleteRefreshToken(token: string): Promise<void>;

	// API Keys (SSO)
	createApiKey(id: string, userId: string, name: string, prefix: string, keyHash: string, expiresAt: string | null): Promise<ApiKeyRecord>;
	listApiKeysByUser(userId: string): Promise<ApiKeyRecord[]>;
	findApiKeyByHash(keyHash: string): Promise<ApiKeyLookup | null>;
	revokeApiKey(id: string, userId: string): Promise<boolean>;
	touchApiKeyLastUsed(id: string): Promise<void>;
}
