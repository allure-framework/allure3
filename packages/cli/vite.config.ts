import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;
const nonParallelFiles = ["./test/commands/run.integration.test.ts"];

export default defineConfig(
  mergeConfig(defaultVitestConfig(packageRoot, { include: [] }), {
    ...defaultTasksConfig(packageRoot),
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
