import { env } from "node:process";

import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    reporters: [{}],
    passWithNoTests: true,
    coverage: {
      enabled: true,
      provider: "istanbul",
      reporter: ["text-summary", env.GITHUB_ACTIONS === "true" ? "cobertura" : "html"],
      reportsDirectory: ".vitest/coverage",
    },
  },
});
