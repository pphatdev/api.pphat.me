import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.test.jsonc" },
			miniflare: {
				bindings: {
					JWT_SECRET: "test-jwt-secret",
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
	},
});
