import { createRequire } from "node:module";

import { defaultTasksConfig } from "@allurereport/common-config";
import { defineConfig } from "vite-plus";

const require = createRequire(import.meta.url);

export default defineConfig({
  ...defaultTasksConfig(import.meta.dirname),
  test: {
    include: ["./test/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [
            { name: "module", value: "plugin-metrics" },
            { name: "coverage", value: "plugin-metrics" },
            { name: "epic", value: "coverage" },
            { name: "feature", value: "plugin-metrics" },
          ],
        },
      ],
    ],
  },
});
