import { cleanup, fireEvent, render } from "@testing-library/preact";
import type { ReportFixtureResult } from "types";
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

import { TrSetup } from "@/components/TestResult/TrSetup";
import { TrTeardown } from "@/components/TestResult/TrTeardown";
import { collapsedTrees, expandedTrees } from "@/stores/tree";

const setupFixture: ReportFixtureResult = {
  id: "fixture-before-1",
  type: "before",
  name: "before fixture",
  status: "passed",
  steps: [],
};

const teardownFixture: ReportFixtureResult = {
  id: "fixture-after-1",
  type: "after",
  name: "after fixture",
  status: "passed",
  steps: [],
};

describe("components > TestResult > TrSetup and TrTeardown", () => {
  beforeEach(() => {
    cleanup();
    collapsedTrees.value = new Set();
    expandedTrees.value = new Set();
    globalThis.allureReportOptions = { stepTreeExpansion: "expand_failed_only" } as any;
  });

  it("collapses setup and teardown sections by default when stepTreeExpansion is collapsed", () => {
    globalThis.allureReportOptions = { stepTreeExpansion: "collapsed" } as any;

    const view = render(
      <>
        <TrSetup id="test-result" setup={[setupFixture]} />
        <TrTeardown id="test-result" teardown={[teardownFixture]} />
      </>,
    );

    expect(view.queryByText("before fixture")).not.toBeInTheDocument();
    expect(view.queryByText("after fixture")).not.toBeInTheDocument();
  });

  it("opens collapsed setup and teardown sections when toggled", () => {
    globalThis.allureReportOptions = { stepTreeExpansion: "collapsed" } as any;

    const view = render(
      <>
        <TrSetup id="test-result" setup={[setupFixture]} />
        <TrTeardown id="test-result" teardown={[teardownFixture]} />
      </>,
    );

    fireEvent.click(view.getByText("Set up"));
    fireEvent.click(view.getByText("Tear down"));

    expect(view.getByText("before fixture")).toBeInTheDocument();
    expect(view.getByText("after fixture")).toBeInTheDocument();
  });
});
