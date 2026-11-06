import type { ReportTestResult } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { resolveTreeLabels } from "../src/treeLabels.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-classic");
  await story("tree labels");
  await label("coverage", "plugin-classic");
});

const tests = [
  {
    labels: ["parentSuite", "suite", "subSuite", "epic", "feature", "story", "package", "owner"].map((name) => ({
      name,
      value: `${name}-value`,
    })),
  },
] as unknown as ReportTestResult[];

describe("resolveTreeLabels", () => {
  it("uses Allure 2 defaults for every tree when groupBy is not set", () => {
    expect(resolveTreeLabels(undefined, tests)).toEqual({
      tree: ["parentSuite", "suite", "subSuite"],
      behaviors: ["epic", "feature", "story"],
      packages: ["package"],
    });
  });

  it("applies groupBy only to the suites tree", () => {
    expect(resolveTreeLabels(["owner"], tests)).toEqual({
      tree: ["owner"],
      behaviors: ["epic", "feature", "story"],
      packages: ["package"],
    });
  });
});
