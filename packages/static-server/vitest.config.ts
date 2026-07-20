import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    include: ["./test/unit/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [
            { name: "module", value: "static-server" },
            { name: "coverage", value: "static-server" },
            { name: "epic", value: "coverage" },
            { name: "feature", value: "static-server" },
          ],
        },
      ],
    ],
  },
});
