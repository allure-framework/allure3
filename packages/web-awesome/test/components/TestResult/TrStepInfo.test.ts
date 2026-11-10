import type { DefaultTestStepResult, TestStepResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { countDescendantAttachments, countDescendantSteps } from "@/components/TestResult/TrSteps/TrStepInfo";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("TrStepInfo");
  await label("coverage", "ui-components");
});

const step = (name: string, children: TestStepResult[] = []): DefaultTestStepResult => ({
  type: "step",
  name,
  status: "passed",
  parameters: [],
  steps: children,
});

const attachment = (name: string): TestStepResult => ({
  type: "attachment",
  link: {
    id: name,
    name,
    contentType: "text/plain",
    originalFileName: `${name}.txt`,
    ext: ".txt",
    missed: false,
    used: true,
  },
});

describe("components > TestResult > TrStepInfo counters", () => {
  it("counts all nested descendant steps recursively (issue #235)", () => {
    // Step 1 -> Step 1.1 -> Step 1.1.1  => parent counter must be 2, not 1
    const root = step("Step 1", [step("Step 1.1", [step("Step 1.1.1")])]);

    expect(countDescendantSteps(root)).toBe(2);
  });

  it("returns 0 when the step has no children", () => {
    expect(countDescendantSteps(step("leaf"))).toBe(0);
  });

  it("counts only steps and ignores sibling attachments in the step counter", () => {
    const root = step("parent", [step("child"), attachment("log")]);

    expect(countDescendantSteps(root)).toBe(1);
  });

  it("counts nested attachments recursively", () => {
    const root = step("parent", [step("child", [attachment("nested-log")]), attachment("direct-log")]);

    expect(countDescendantAttachments(root)).toBe(2);
  });

  it("returns 0 attachments when none exist in the tree", () => {
    expect(countDescendantAttachments(step("parent", [step("child")]))).toBe(0);
  });
});
