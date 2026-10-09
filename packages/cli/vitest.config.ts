import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

const nonParallelFiles = [
  "./test/commands/run.integration.test.ts", // runs yarn build;
  "./test/utils/supervisor/posix.test.ts", // asserts process listeners;
  "./test/utils/supervisor/windows.test.ts", // asserts process listeners;
];

export default defineConfig({
  test: {
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "cli" }] },
      ],
    ],
    projects: [
      {
        extends: true,
        test: {
          name: "parallel",
          include: ["./test/**/*.test.ts"],
          exclude: [...nonParallelFiles],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "non-parallel",
          include: [...nonParallelFiles],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
