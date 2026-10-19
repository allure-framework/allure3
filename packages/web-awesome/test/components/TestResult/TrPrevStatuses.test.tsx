import type { HistoryTestResult } from "@allurereport/core-api";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { TrPrevStatuses } from "@/components/TestResult/TrPrevStatuses";

const makeHistoryItem = (
  id: string,
  stop: number | undefined,
  overrides: Partial<HistoryTestResult> = {},
): HistoryTestResult => ({
  id,
  name: "historical test result",
  status: "passed",
  stop,
  url: `https://example.com/${id}`,
  ...overrides,
});

const getHistoryLinks = () => screen.queryAllByRole("link").map((link) => link.getAttribute("href"));

afterEach(cleanup);

describe("components > TestResult > TrPrevStatuses", () => {
  it("should sort historical links by stop timestamp regardless of input order", () => {
    render(
      <TrPrevStatuses
        history={[makeHistoryItem("middle", 2000), makeHistoryItem("oldest", 1000), makeHistoryItem("newest", 3000)]}
      />,
    );

    expect(getHistoryLinks()).toEqual([
      "https://example.com/oldest",
      "https://example.com/middle",
      "https://example.com/newest",
    ]);
  });

  it("should display only the six most recent results in chronological order", () => {
    render(
      <TrPrevStatuses
        history={[
          makeHistoryItem("run-8", 8000),
          makeHistoryItem("run-7", 7000),
          makeHistoryItem("run-6", 6000),
          makeHistoryItem("run-5", 5000),
          makeHistoryItem("run-4", 4000),
          makeHistoryItem("run-3", 3000),
          makeHistoryItem("run-2", 2000),
          makeHistoryItem("run-1", 1000),
        ]}
      />,
    );

    expect(getHistoryLinks()).toEqual([
      "https://example.com/run-3",
      "https://example.com/run-4",
      "https://example.com/run-5",
      "https://example.com/run-6",
      "https://example.com/run-7",
      "https://example.com/run-8",
    ]);
  });

  it("should place results without stop timestamps before timestamped results", () => {
    render(
      <TrPrevStatuses
        history={[
          makeHistoryItem("newest", 3000),
          makeHistoryItem("missing-stop", undefined),
          makeHistoryItem("oldest", 1000),
        ]}
      />,
    );

    expect(getHistoryLinks()).toEqual([
      "https://example.com/missing-stop",
      "https://example.com/oldest",
      "https://example.com/newest",
    ]);
  });
});
