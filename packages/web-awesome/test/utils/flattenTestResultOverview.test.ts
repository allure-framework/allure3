import { describe, expect, it } from "vitest";

import { flattenTestResultOverview } from "@/utils/flattenTestResultOverview";

describe("flattenTestResultOverview", () => {
  it("skips metadata sections and lists execution blocks with nested steps", () => {
    const flat = flattenTestResultOverview({
      testResultId: "tr-1",
      hasSetup: false,
      setupBodyItems: [],
      bodyItems: [
        {
          type: "step",
          item: {
            stepId: "step-a",
            name: "Step A",
            status: "passed",
          },
          bodyItems: [],
          suppressInlineError: false,
        },
      ],
      hasTeardown: false,
      teardownBodyItems: [],
      isGroupOpened: () => true,
      stepExpansionPolicy: "expanded",
    });

    expect(flat.map((node) => node.id)).toEqual(["tr-1-steps", "step-a"]);
  });

  it("hides nested steps when the steps block is collapsed", () => {
    const flat = flattenTestResultOverview({
      testResultId: "tr-2",
      hasSetup: false,
      setupBodyItems: [],
      bodyItems: [
        {
          type: "step",
          item: {
            stepId: "step-b",
            name: "Step B",
            status: "passed",
          },
          bodyItems: [],
          suppressInlineError: false,
        },
      ],
      hasTeardown: false,
      teardownBodyItems: [],
      isGroupOpened: () => false,
      stepExpansionPolicy: "collapsed",
    });

    expect(flat.map((node) => node.id)).toEqual(["tr-2-steps"]);
  });
});
