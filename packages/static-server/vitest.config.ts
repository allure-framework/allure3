import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  include: ["./test/unit/**/*.test.ts"],
  globalLabels: [
    { name: "module", value: "static-server" },
    { name: "coverage", value: "static-server" },
    { name: "epic", value: "coverage" },
    { name: "feature", value: "static-server" },
  ],
});
