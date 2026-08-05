import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";
import { AuthRepository } from "../../apps/modules/auth/auth.repo";

/**
 * Regression tests for C5 — OTP brute-force protection.
 * Before this fix, verifyAndConsumeOtp incremented no counter on wrong
 * guesses; an attacker could exhaust the 10-minute window at 1M / attempts_per_second.
 */
describe("Auth OTP lockout (C5)", () => {
	beforeAll(async () => {
		await seedDatabase(env.DB);
	});

	it("invalidates the OTP after the attempt cap is reached", async () => {
		const repo = new AuthRepository(env.DB);
		const email = `otp-lockout-${Date.now()}@example.com`;

		// Create a fresh OTP with a 10-minute lifetime
		const code = "123456";
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
		await repo.createOtp(email, code, expiresAt);

		// Five wrong guesses (cap = 5). The fifth should trip the lockout,
		// so any subsequent guess — even the correct one — must return false.
		for (let i = 0; i < 5; i++) {
			const ok = await repo.verifyAndConsumeOtp(email, "000000");
			expect(ok).toBe(false);
		}

		const correctAfterLockout = await repo.verifyAndConsumeOtp(email, code);
		expect(correctAfterLockout).toBe(false);
	});

	it("still accepts the correct code within the attempt window", async () => {
		const repo = new AuthRepository(env.DB);
		const email = `otp-happy-${Date.now()}@example.com`;
		const code = "654321";
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
		await repo.createOtp(email, code, expiresAt);

		// A couple of wrong guesses, then the right one — should succeed.
		await repo.verifyAndConsumeOtp(email, "111111");
		await repo.verifyAndConsumeOtp(email, "222222");
		const ok = await repo.verifyAndConsumeOtp(email, code);
		expect(ok).toBe(true);
	});
});
