import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vitest/config";

const nonParallelFiles = ["./test/commands/run.integration.test.ts"];

export default mergeConfig(
  defaultVitestConfig({ include: [] }),
  defineConfig({
    test: {
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
  }),
);
