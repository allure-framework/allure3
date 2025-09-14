import { defineConfig } from "@playwright/test";
import { platform } from "node:os";

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

export default defineConfig({
  testDir: "./test/e2e",
  reporter: [
    ["line"],
    [
      "allure-playwright",
      {
        resultsDir: "./out/allure-results",
        globalLabels: [
          { name: "module", value: "static-server" },
          { name: "os", value: getOsLabel() },
        ],
      },
    ],
  ],
});
