import { env } from "node:process";

import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    reporters: [{}],
    passWithNoTests: true,
    coverage: {
      enabled: true,
      reportOnFailure: true,
      provider: "istanbul",
      reporter: ["text-summary", env.GITHUB_ACTIONS === "true" ? "cobertura" : "html"],
      reportsDirectory: ".vitest/coverage",
    },
  },
});
