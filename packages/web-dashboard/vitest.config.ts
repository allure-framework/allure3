import { createRequire } from "node:module";
import { platform } from "node:os";
import { defineConfig } from "vitest/config";

const getOsLabel = () => {
  switch (platform()) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return platform();
  }
};

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["./test/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "web-dashboard" }, { name: "os", value: getOsLabel() }] },
      ],
    ],
  },
});
