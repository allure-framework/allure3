import { cleanup, render } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import { TrSteps } from "@/components/TestResult/TrSteps";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import { collapsedTrees, expandedTrees } from "@/stores/tree";

const nestedPassedStep = {
  type: "step",
  item: {
    stepId: "nested-passed-step",
    name: "nested passed step",
    status: "passed",
    parameters: [],
    message: "",
    trace: "",
    hasSimilarErrorInSubSteps: false,
  },
  suppressInlineError: false,
  bodyItems: [],
} satisfies TrBodyItem;

const passedStepWithContent = {
  type: "step",
  item: {
    stepId: "passed-step",
    name: "passed step",
    status: "passed",
    parameters: [],
    message: "",
    trace: "",
    hasSimilarErrorInSubSteps: false,
  },
  suppressInlineError: false,
  bodyItems: [nestedPassedStep],
} satisfies TrBodyItem;

const failedStepWithContent = {
  type: "step",
  item: {
    stepId: "failed-step",
    name: "failed step",
    status: "failed",
    parameters: [],
    message: "failed",
    trace: "trace",
    hasSimilarErrorInSubSteps: false,
  },
  suppressInlineError: false,
  bodyItems: [nestedPassedStep],
} satisfies TrBodyItem;

const createTopLevelStep = (index: number, status: "passed" | "failed"): TrBodyItem => ({
  type: "step",
  item: {
    stepId: `step-${index}`,
    name: `${status} step ${index}`,
    status,
    parameters: [],
    message: status === "failed" ? "failed" : "",
    trace: status === "failed" ? "trace" : "",
    hasSimilarErrorInSubSteps: false,
  },
  suppressInlineError: false,
  bodyItems: [
    {
      type: "attachment",
      link: {
        id: `attachment-${index}`,
        source: `attachment-${index}.png`,
        name: `attachment ${index}`,
        contentType: "image/png",
      },
    },
  ],
});

describe("components > TestResult > TrSteps", () => {
  beforeEach(() => {
    cleanup();
    collapsedTrees.value = new Set();
    expandedTrees.value = new Set();
    globalThis.allureReportOptions = { stepTreeExpansion: "expand_failed_only" } as any;
  });

  it("always shows the steps root container regardless of step status", () => {
    const view = render(<TrSteps id="test" bodyItems={[passedStepWithContent]} />);

    expect(view.getByTestId("test-result-steps-root")).toBeInTheDocument();
  });

  it("collapses top-level passed steps by default with expand_failed_only", () => {
    const view = render(<TrStep item={passedStepWithContent} stepIndex={1} />);

    expect(view.queryByTestId("test-result-step-content")).not.toBeInTheDocument();
  });

  it("collapses top-level steps when policy is collapsed", () => {
    globalThis.allureReportOptions = { stepTreeExpansion: "collapsed" } as any;
    const view = render(<TrStep item={passedStepWithContent} stepIndex={1} />);

    expect(view.queryByTestId("test-result-step-content")).not.toBeInTheDocument();
  });

  it("opens top-level failed steps by default with expand_failed_only", () => {
    const view = render(<TrSteps id="failed-test" bodyItems={[failedStepWithContent]} />);

    expect(view.getByTestId("test-result-step-content")).toBeInTheDocument();
  });

  it("opens only failed top-level steps by default in large flat step lists", () => {
    const bodyItems = Array.from({ length: 750 }, (_, index) =>
      createTopLevelStep(index, index % 25 === 0 ? "failed" : "passed"),
    );
    const view = render(<TrSteps id="large-test" bodyItems={bodyItems} />);

    expect(view.getAllByTestId("test-result-step")).toHaveLength(750);
    expect(view.getAllByTestId("test-result-step-content")).toHaveLength(30);
    expect(view.getAllByTestId("test-result-attachment")).toHaveLength(30);
  });

  it("collapses nested passed steps by default with expand_failed_only", () => {
    expandedTrees.value = new Set(["passed-step"]);
    const view = render(<TrStep item={passedStepWithContent} stepIndex={1} />);

    expect(view.queryAllByTestId("test-result-step-content")).toHaveLength(1);
  });
});
