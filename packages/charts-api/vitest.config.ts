import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({ globalLabels: [{ name: "module", value: "reader-api" }] });
