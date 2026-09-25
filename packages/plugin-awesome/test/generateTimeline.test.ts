import type { TestResult } from "@allurereport/core-api";
import { epic, feature, story } from "allure-js-commons";
import { beforeEach, expect, it, vi } from "vitest";

import { generateTimeline } from "../src/generateTimeline.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("timeline environments");
});

it("renders configured names without changing stored environment IDs", async () => {
  const writeWidget = vi.fn();
  const result = {
    id: "result",
    name: "test",
    status: "passed",
    start: 1,
    stop: 5,
    duration: 4,
    environment: "qa-eu",
    labels: [
      { name: "host", value: "host" },
      { name: "thread", value: "thread" },
    ],
    retryHash: "case.params.env",
    isRetry: false,
  } as TestResult;
  await generateTimeline(
    { writeWidget },
    [result],
    {},
    new Map([["result", "qa-eu"]]),
    new Map([["qa-eu", "Quality Assurance"]]),
  );
  expect(writeWidget).toHaveBeenCalledWith("timeline.json", [
    expect.objectContaining({
      environment: "qa-eu",
      environmentName: "Quality Assurance",
      retryHash: result.retryHash,
    }),
  ]);
  expect(result.environment).toBe("qa-eu");
});
