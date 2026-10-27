import { defaultVitestConfig } from "@allurereport/common-config";
import { mergeConfig } from "vite-plus";

export default mergeConfig(
  defaultVitestConfig(import.meta.dirname, {
    include: ["./test/performance/report-generation.probe.ts"],
  }),
  {
    test: {
      setupFiles: ["./test/setup/performance.ts"],
      sequence: { setupFiles: "list" },
      testTimeout: 1_200_000,
    },
  },
);
