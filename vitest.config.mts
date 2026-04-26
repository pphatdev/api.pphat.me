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
	},
});
