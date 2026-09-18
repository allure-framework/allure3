import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // An empty list restores the default reporter; a no-op suppresses replayed test results.
    reporters: [{}],
    passWithNoTests: true,
    coverage: {
      enabled: true,
      provider: "istanbul",
      reporter: ["html", "text-summary", "json-summary"],
      reportsDirectory: "coverage/report",
    },
  },
});
