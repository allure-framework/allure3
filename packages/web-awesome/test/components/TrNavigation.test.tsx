import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import type { ReportTestResult } from "types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { TrNavigation } from "@/components/TestResult/TrNavigation";
import { waitForI18next } from "@/stores/locale";
import { testResultNavStore, testResultStore } from "@/stores/testResults";

const setHash = (hash: string) => {
  window.history.pushState(null, "", hash ? `#${hash}` : "/");
  window.dispatchEvent(new Event("pushState"));
};

const setTestResults = (results: Record<string, Partial<ReportTestResult>>) => {
  testResultStore.value = {
    loading: false,
    error: undefined,
    data: Object.fromEntries(
      Object.entries(results).map(([id, result]) => [
        id,
        {
          id,
          nodeId: id,
          name: `Test ${id}`,
          status: "passed",
          setup: [],
          teardown: [],
          steps: [],
          labels: [],
          groupedLabels: {},
          links: [],
          parameters: [],
          breadcrumbs: [],
          history: [],
          ...result,
        } as ReportTestResult,
      ]),
    ),
  };
};

beforeEach(async () => {
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
  await epic("coverage");
  await feature("test-result");
  await story("copy-identifiers");
  await label("coverage", "ui-components");
  await waitForI18next;
  setHash("");
  testResultNavStore.value = { loading: true, error: undefined, data: undefined };
  testResultStore.value = { loading: true, error: undefined, data: undefined };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const testResult = {
  id: "test-result-id",
  fullName: "test fullname",
  testCase: { id: "test-case-id", name: "test" },
  retryHash: "retry-hash",
  isRetry: false,
} as ReportTestResult;

describe("components > TestResult > TrNavigation", () => {
  it("shows identifier copy options on hover and copies each value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<TrNavigation testResult={testResult} />);
    const trigger = screen.getByTestId("test-result-fullname-copy-trigger");

    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("Fullname")).toBeInTheDocument();
    expect(screen.getByText("Test case ID")).toBeInTheDocument();
    expect(screen.getByText("Retry hash")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-result-copy-fullname"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("test fullname"));

    fireEvent.mouseEnter(trigger);
    fireEvent.click(screen.getByTestId("test-result-copy-test-case-id"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("test-case-id"));

    fireEvent.mouseEnter(trigger);
    fireEvent.click(screen.getByTestId("test-result-copy-retry-hash"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("retry-hash"));
  });

  it("shows test case id copy option when test case id exists without fullname", () => {
    render(<TrNavigation testResult={{ ...testResult, fullName: undefined }} />);
    fireEvent.mouseEnter(screen.getByTestId("test-result-fullname-copy-trigger"));

    expect(screen.getByTestId("test-result-copy-test-case-id")).toBeInTheDocument();
    expect(screen.queryByTestId("test-result-copy-fullname")).not.toBeInTheDocument();
  });

  it("keeps menu open while pointer moves from trigger to menu", async () => {
    vi.useFakeTimers();
    render(<TrNavigation testResult={testResult} />);
    const trigger = screen.getByTestId("test-result-fullname-copy-trigger");

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    const menu = screen.getByTestId("test-result-copy-menu");
    fireEvent.mouseEnter(menu);

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByTestId("test-result-copy-fullname")).toBeInTheDocument();

    fireEvent.mouseLeave(menu);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.queryByTestId("test-result-copy-fullname")).not.toBeInTheDocument();
  });

  it("opens overview when navigating to a result without the current resolution categories tab", () => {
    setHash("tr-1/resolutionCategories");
    testResultNavStore.value = { loading: false, error: undefined, data: ["tr-1", "tr-2"] };
    setTestResults({ "tr-1": { resolution: "issue" }, "tr-2": {} });

    render(<TrNavigation testResult={{ ...testResult, id: "tr-1", resolution: "issue" }} />);

    fireEvent.click(screen.getByTestId("test-result-nav-next"));

    expect(window.location.hash).toBe("#tr-2");
  });
});
