import { createRequire } from "node:module";
import { env } from "node:process";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const resultsDir = env.ALLURE_RESULTS_DIR ?? "./out/allure-results";

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir,
          globalLabels: [
            { name: "module", value: "reader" },
          ],
        },
      ],
    ],
  },
});
