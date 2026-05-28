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
import { collapsedTrees, expandedTrees } from "@/stores/tree";

const passedStep = {
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
  bodyItems: [],
} satisfies TrBodyItem;

const failedStep = {
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
  bodyItems: [],
} satisfies TrBodyItem;

describe("components > TestResult > TrSteps", () => {
  beforeEach(() => {
    cleanup();
    collapsedTrees.value = new Set();
    expandedTrees.value = new Set();
    globalThis.allureReportOptions = { stepTreeExpansion: "expand_failed_only" } as any;
  });

  it("collapses passed-only root steps by default with expand_failed_only", () => {
    const view = render(<TrSteps id="passed-test" bodyItems={[passedStep]} />);

    expect(view.queryByTestId("test-result-steps-root")).not.toBeInTheDocument();
  });

  it("opens root steps by default when expand_failed_only finds failed context", () => {
    const view = render(<TrSteps id="failed-test" bodyItems={[passedStep, failedStep]} />);

    expect(view.getByTestId("test-result-steps-root")).toBeInTheDocument();
  });
});
