import { defineConfig } from "vite-plus";

import config from "./vitest.config.js";

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["./test/performance/report-generation.probe.ts"],
    testTimeout: 1_200_000,
  },
});
