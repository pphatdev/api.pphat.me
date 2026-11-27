import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.test.jsonc" },
			miniflare: {
				// Pinned so a developer's local secrets (wrangler loads .env /
				// .dev.vars) never reach the suite: with a real SMTP_PASS, tests
				// that register users or invite contributors would send real mail.
				bindings: {
					JWT_SECRET: "test-jwt-secret",
					SMTP_PASS: "",
				},
			},
		}),
	],
	test: {
		include: ["test/**/*.spec.ts"],
		// PBKDF2 at 600k iterations (#36) makes any test that hits register +
		// verify + login cost ~1.5s in aggregate under parallel workerd
		// isolates. The 5s default gets crowded — 15s keeps flakiness away
		// without hiding a genuinely stuck test.
		testTimeout: 15_000,
		// Every spec seeds its own fresh D1 in beforeAll — that runs the full
		// migration set + seed SQL sequentially. The migration set has grown
		// past 25 files, and under full-suite parallel load (24 specs each
		// seeding simultaneously) the 10s Vitest default times out even on a
		// green run. Keep the hook ceiling in step with the test ceiling.
		hookTimeout: 20_000,
	},
});
