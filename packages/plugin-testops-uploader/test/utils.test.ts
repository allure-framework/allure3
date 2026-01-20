import type { TestStepResult } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";
import { unwrapStepsAttachments } from "../src/utils.js";

describe("unwrapStepsAttachments", () => {
  it("should return empty array when given empty array", () => {
    const result = unwrapStepsAttachments([]);

    expect(result).toEqual([]);
  });

  it("should return steps unchanged when they don't have attachments", () => {
    const steps = [
      {
        name: "step 1",
        parameters: [],
        status: "passed",
        steps: [],
      } as unknown as TestStepResult,
      {
        name: "step 2",
        parameters: [],
        status: "failed",
        steps: [],
      } as unknown as TestStepResult,
    ];

    expect(unwrapStepsAttachments(steps)).toEqual(steps);
  });

  it("should transform attachment step by adding attachment field from link", () => {
    const link = {
      id: "attachment-1",
      originalFileName: "screenshot.png",
      contentType: "image/png",
    };
    const steps: TestStepResult[] = [
      {
        type: "attachment",
        link,
      } as unknown as TestStepResult,
    ];

    expect(unwrapStepsAttachments(steps)).toEqual([
      {
        type: "attachment",
        link,
        attachment: link,
      },
    ]);
  });

  it("should recursively process nested steps", () => {
    const link = {
      id: "nested-attachment",
      originalFileName: "nested.txt",
      contentType: "text/plain",
    };
    const steps = [
      {
        name: "parent step",
        parameters: [],
        status: "passed",
        steps: [
          {
            name: "child step",
            parameters: [],
            status: "passed",
            steps: [],
          } as unknown as TestStepResult,
          {
            type: "attachment",
            link,
          } as unknown as TestStepResult,
        ],
      } as unknown as TestStepResult,
    ];

    const result = unwrapStepsAttachments(steps);

    expect(result[0]).toHaveProperty("steps");

    const parentStep = result[0] as any;

    expect(parentStep.steps).toHaveLength(2);
    expect(parentStep.steps[1]).toHaveProperty("attachment", link);
  });
});
