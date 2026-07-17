import { render, screen } from "@testing-library/preact";
import type { AwesomeTestResult } from "types";
import { describe, expect, it, vi } from "vitest";

import { TrRetriesView } from "@/components/TestResult/TrRetriesView";

vi.mock("@allurereport/web-components", () => ({
  ArrowButton: () => (
    <button aria-label="Toggle retry" data-testid="test-result-retries-item-arrow-button" type="button" />
  ),
  EmptyView: (props: { description: string }) => <div data-testid="empty-view">{props.description}</div>,
  IconButton: (props: { "onClick": () => void; "data-testid"?: string }) => (
    <button aria-label="Open retry" data-testid={props["data-testid"]} type="button" onClick={props.onClick} />
  ),
  Text: (props: { "children": unknown; "data-testid"?: string }) => (
    <span data-testid={props["data-testid"]}>{props.children}</span>
  ),
  TreeItemIcon: () => <span data-testid="retry-status" />,
  allureIcons: {
    lineArrowsChevronDown: "chevron",
    lineGeneralLinkExternal: "external",
  },
}));

vi.mock("@/components/TestResult/TrError", () => ({
  TrError: () => <div data-testid="test-result-error" />,
}));

vi.mock("@/stores", () => ({
  useI18n: (namespace: string) => ({
    t: (key: string) =>
      namespace === "empty" && key === "no-retries-results" ? "No retries information available" : key,
  }),
}));

vi.mock("@/stores/locale", () => ({
  useI18n: (namespace: string) =>
    namespace === "controls"
      ? {
          t: (key: string) => (key === "comparison" ? "Comparison" : key),
        }
      : {
          t: (_key: string, params: { attempt: number; total: number }) =>
            `Attempt ${params.attempt} of ${params.total}`,
        },
}));

vi.mock("@/stores/router", () => ({
  navigateToTestResult: vi.fn(),
}));

vi.mock("@/utils/time", () => ({
  timestampToDate: (value: number) => `date:${value}`,
}));

const makeTestResult = (overrides: Partial<AwesomeTestResult> = {}): AwesomeTestResult =>
  ({
    id: "test-result-id",
    name: "test",
    status: "failed",
    fullName: "test.fullName",
    flaky: false,
    muted: false,
    known: false,
    isRetry: false,
    labels: [],
    groupedLabels: {},
    parameters: [],
    links: [],
    steps: [],
    error: undefined,
    environment: "default",
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    titlePath: [],
    attachments: [],
    ...overrides,
  }) as AwesomeTestResult;

describe("components > TestResult > TrRetriesView", () => {
  it("renders retry attempts from oldest to newest with the current attempt included in the total", () => {
    render(
      <TrRetriesView
        testResult={makeTestResult({
          retries: [
            makeTestResult({ id: "retry-3", stop: 3000 }),
            makeTestResult({ id: "retry-2", stop: 2000 }),
            makeTestResult({ id: "retry-1", stop: 1000 }),
          ],
        })}
      />,
    );

    expect(screen.getAllByTestId("test-result-retries-item-text").map((item) => item.textContent)).toEqual([
      "Attempt 1 of 4 – date:1000",
      "Attempt 2 of 4 – date:2000",
      "Attempt 3 of 4 – date:3000",
    ]);
  });

  it("renders an empty state when there are no retries", () => {
    render(<TrRetriesView testResult={makeTestResult()} />);

    expect(screen.getByTestId("empty-view")).toHaveTextContent("No retries information available");
  });
});
