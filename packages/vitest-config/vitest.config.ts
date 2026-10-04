import { env } from "node:process";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
