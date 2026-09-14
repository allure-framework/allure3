import type { TestStatus } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { testStatusToLaunchStatus } from "../src/utils/launches.js";

const cases = [
  ["passed", "passed"],
  ["skipped", "passed"],
  ["failed", "failed"],
  ["broken", "failed"],
  ["unknown", "unknown"],
] as const satisfies ReadonlyArray<readonly [TestStatus, ReturnType<typeof testStatusToLaunchStatus>]>;

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("launches");
  await label("coverage", "testops-integration");
});

describe("testStatusToLaunchStatus", () => {
  it.each(cases)("should map %s to %s", (status, expected) => {
    expect(testStatusToLaunchStatus(status)).toBe(expected);
  });
});
