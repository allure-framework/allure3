import { env } from "node:process";

import { defineConfig } from "vitest/config";

const { ENABLE_COVERAGE } = env;

export default defineConfig({
  test: {
    reporters: [{}],
    passWithNoTests: true,
    coverage: {
      enabled: ENABLE_COVERAGE === "true",
      provider: "istanbul",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: ".vitest/coverage",
    },
  },
});
