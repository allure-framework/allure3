import { describe, expect, it } from "vitest";

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import {
  collectExpandableStepNodes,
  getNextSubtreeToggleState,
  hasFailedStepContext,
  isOpenByDefaultForPolicy,
  isStepOpenedByDefault,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";

describe("components > TestResult > stepTreeExpansion", () => {
  it("should detect failed context in nested steps", () => {
    const bodyItems = [
      {
        type: "step",
        item: {
          name: "top-level step",
          status: "passed",
        },
        suppressInlineError: false,
        bodyItems: [
          {
            type: "step",
            item: {
              name: "failed nested step",
              status: "failed",
            },
            suppressInlineError: false,
            bodyItems: [],
          },
        ],
      },
    ] as TrBodyItem[];

    expect(hasFailedStepContext(bodyItems)).toBe(true);
  });

  it("should not detect failed context for only passed steps and attachments", () => {
    const bodyItems = [
      {
        type: "step",
        item: {
          name: "top-level step",
          status: "passed",
        },
        suppressInlineError: false,
        bodyItems: [],
      },
      {
        type: "attachment",
        link: {
          id: "attachment-1",
          source: "attachment-1.txt",
          name: "attachment",
          type: "text/plain",
        },
      },
    ] as TrBodyItem[];

    expect(hasFailedStepContext(bodyItems)).toBe(false);
  });

  it("should resolve default expansion state according to policy", () => {
    expect(isOpenByDefaultForPolicy("expanded", false)).toBe(true);
    expect(isOpenByDefaultForPolicy("collapsed", true)).toBe(false);
    expect(isOpenByDefaultForPolicy("expand_failed_only", true)).toBe(true);
    expect(isOpenByDefaultForPolicy("expand_failed_only", false)).toBe(false);
  });

  it("should resolve step default opening according to status and nested failures", () => {
    const failedBodyItems = [
      {
        type: "step",
        item: {
          name: "nested failed step",
          status: "failed",
        },
        suppressInlineError: false,
        bodyItems: [],
      },
    ] as TrBodyItem[];

    expect(isStepOpenedByDefault("expand_failed_only", "passed", failedBodyItems)).toBe(true);
    expect(isStepOpenedByDefault("expand_failed_only", "passed", [])).toBe(false);
  });

  it("should collect expandable step and error nodes with correct defaults", () => {
    const bodyItems = [
      {
        type: "step",
        item: {
          stepId: "parent-step",
          name: "parent step",
          status: "passed",
          parameters: [],
          message: "",
          trace: "",
          hasSimilarErrorInSubSteps: false,
        },
        suppressInlineError: false,
        bodyItems: [
          {
            type: "step",
            item: {
              stepId: "failed-child-step",
              name: "failed child step",
              status: "failed",
              parameters: [],
              message: "child failed",
              trace: "trace",
              hasSimilarErrorInSubSteps: false,
            },
            suppressInlineError: false,
            bodyItems: [],
          },
          {
            type: "error",
            id: "test-error",
            title: "Error",
            status: "failed",
            error: {
              message: "failure",
              trace: "trace",
            },
          },
        ],
      },
    ] as TrBodyItem[];

    expect(collectExpandableStepNodes(bodyItems, "expand_failed_only")).toEqual([
      { id: "parent-step", openedByDefault: true },
      { id: "failed-child-step", openedByDefault: true },
      { id: "test-error", openedByDefault: true },
    ]);
  });

  it("should calculate next subtree toggle state like categories", () => {
    expect(
      getNextSubtreeToggleState({
        hasOnlyLeafResults: false,
        isSubtreeCollapsedAll: true,
        isSubtreeFirstLevelOnly: false,
        isSubtreeExpandedAll: false,
        lastSubtreeToggle: null,
      }),
    ).toBe("first");

    expect(
      getNextSubtreeToggleState({
        hasOnlyLeafResults: false,
        isSubtreeCollapsedAll: false,
        isSubtreeFirstLevelOnly: true,
        isSubtreeExpandedAll: false,
        lastSubtreeToggle: null,
      }),
    ).toBe("all");

    expect(
      getNextSubtreeToggleState({
        hasOnlyLeafResults: false,
        isSubtreeCollapsedAll: false,
        isSubtreeFirstLevelOnly: true,
        isSubtreeExpandedAll: false,
        lastSubtreeToggle: "all",
      }),
    ).toBe("none");

    expect(
      getNextSubtreeToggleState({
        hasOnlyLeafResults: true,
        isSubtreeCollapsedAll: false,
        isSubtreeFirstLevelOnly: false,
        isSubtreeExpandedAll: true,
        lastSubtreeToggle: "all",
      }),
    ).toBe("none");
  });
});
