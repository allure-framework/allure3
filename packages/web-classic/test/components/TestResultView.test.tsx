// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TestResultNavigation } from "../../src/components/TestResult/TestResultNavigation/index.js";
import { TestResultView } from "../../src/components/TestResultView/index.js";
import { route } from "../../src/stores/router.js";
import { testResultNavStore, testResultStore } from "../../src/stores/testResults.js";
import type { ReportTestResult } from "../../types.js";

const { fetchReportJsonData } = vi.hoisted(() => ({ fetchReportJsonData: vi.fn() }));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportJsonData,
}));

vi.mock("@/components/TestResult", () => ({
  default: ({ testResult }: { testResult?: ReportTestResult }) => <div data-testid="result">{testResult?.name}</div>,
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("test result navigation");
  await label("coverage", "ui-components");

  testResultStore.value = { loading: true, error: undefined, data: undefined };
});

afterEach(() => {
  cleanup();
  fetchReportJsonData.mockReset();
});

describe("TestResultView", () => {
  it("fetches an uncached test result when the route changes while the view stays mounted", async () => {
    fetchReportJsonData.mockImplementation(async (path: string) => ({
      name: path.includes("tr-b") ? "second" : "first",
    }));
    route.value = { tabName: "testresult", params: { id: "tr-a", testResultId: null, testResultTab: null } };

    render(<TestResultView />);

    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("first"));

    route.value = { tabName: "testresult", params: { id: "tr-b", testResultId: null, testResultTab: null } };

    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("second"));
    expect(fetchReportJsonData).toHaveBeenCalledWith("data/test-results/tr-b.json");
  });
});

describe("TestResultNavigation", () => {
  it("names both arrows for assistive technology, including the disabled one", () => {
    testResultNavStore.value = { loading: false, error: undefined, data: ["tr-a", "tr-b"] };

    render(<TestResultNavigation testResult={{ id: "tr-a", isRetry: false } as ReportTestResult} />);

    const prev = screen.getByTestId("test-result-nav-prev");
    const next = screen.getByTestId("test-result-nav-next");

    expect(prev.hasAttribute("disabled")).toBe(true);
    expect(prev.getAttribute("aria-label")).toEqual(expect.stringMatching(/\S/));
    expect(next.getAttribute("aria-label")).toEqual(expect.stringMatching(/\S/));
    expect(next.getAttribute("aria-label")).not.toBe(prev.getAttribute("aria-label"));
  });
});
