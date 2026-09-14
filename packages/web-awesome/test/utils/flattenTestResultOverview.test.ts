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

  it("hides setup and teardown children when the step expansion policy is collapsed", () => {
    const flat = flattenTestResultOverview({
      testResultId: "tr-3",
      hasSetup: true,
      setupBodyItems: [
        {
          type: "step",
          item: {
            stepId: "setup-fixture",
            name: "Setup fixture",
            status: "passed",
          },
          bodyItems: [],
          suppressInlineError: false,
        },
      ],
      bodyItems: [],
      hasTeardown: true,
      teardownBodyItems: [
        {
          type: "step",
          item: {
            stepId: "teardown-fixture",
            name: "Teardown fixture",
            status: "passed",
          },
          bodyItems: [],
          suppressInlineError: false,
        },
      ],
      isGroupOpened: (_id, openedByDefault) => openedByDefault,
      stepExpansionPolicy: "collapsed",
    });

    expect(flat.map((node) => node.id)).toEqual(["tr-3-setup", "tr-3-teardown"]);
    expect(flat.map((node) => node.openedByDefault)).toEqual([false, false]);
  });
});
