import { platform } from "node:os";

import { defaultVitestConfig } from "@allurereport/vitest-config";

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

export default defaultVitestConfig({
  globalLabels: [
    { name: "module", value: "plugin-jira" },
    { name: "coverage", value: "plugin-jira" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "plugin-jira" },
    { name: "os", value: getOsLabel() },
  ],
});
