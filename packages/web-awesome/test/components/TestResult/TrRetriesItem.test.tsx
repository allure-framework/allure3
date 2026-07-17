import { fireEvent, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrRetriesItem } from "@/components/TestResult/TrRetriesView/TrRetriesItem";

import type { AwesomeTestResult } from "../../../types";

vi.mock("@allurereport/web-components", () => ({
  ArrowButton: () => <button data-testid="test-result-retries-item-arrow-button" type="button" />,
  IconButton: (props: { "onClick": () => void; "data-testid"?: string }) => (
    <button data-testid={props["data-testid"]} type="button" onClick={props.onClick} />
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
  TrError: (props: { message?: string; trace?: string; actual?: string; expected?: string }) => (
    <div data-testid="test-result-error">{props.message || props.trace || `${props.actual} ${props.expected}`}</div>
  ),
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

const makeRetry = (overrides: Partial<AwesomeTestResult> = {}): AwesomeTestResult =>
  ({
    id: "retry-id",
    name: "retry",
    status: "failed",
    fullName: "retry.fullName",
    flaky: false,
    muted: false,
    known: false,
    isRetry: true,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("components > TestResult > TrRetriesItem", () => {
  it("should render retry error message preview without expanding details", () => {
    render(
      <TrRetriesItem
        attempt={1}
        totalAttempts={2}
        testResultItem={makeRetry({
          stop: 1000,
          duration: 500,
          error: {
            message: "Expected true to be false",
            trace: "stack trace",
          },
        })}
      />,
    );

    expect(screen.getByTestId("test-result-retries-item-error-preview")).toHaveTextContent("Expected true to be false");
    expect(screen.queryByTestId("test-result-error")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-result-retries-item-arrow-button"));

    expect(screen.getByTestId("test-result-error")).toHaveTextContent("Expected true to be false");
  });

  it("should use first meaningful trace line when message is missing", () => {
    render(
      <TrRetriesItem
        attempt={1}
        totalAttempts={2}
        testResultItem={makeRetry({
          error: {
            trace: "\n\nAssertionError: timeout\n    at test.ts:1",
          },
        })}
      />,
    );

    expect(screen.getByTestId("test-result-retries-item-error-preview")).toHaveTextContent("AssertionError: timeout");
  });

  it("should use trace preview when message is only whitespace", () => {
    render(
      <TrRetriesItem
        attempt={1}
        totalAttempts={2}
        testResultItem={makeRetry({
          error: {
            message: "   ",
            trace: "\nAssertionError: retry failed",
          },
        })}
      />,
    );

    expect(screen.getByTestId("test-result-retries-item-arrow-button")).toBeInTheDocument();
    expect(screen.getByTestId("test-result-retries-item-error-preview")).toHaveTextContent(
      "AssertionError: retry failed",
    );
  });

  it("should render diff-only retry preview and keep details expandable", () => {
    render(
      <TrRetriesItem
        attempt={1}
        totalAttempts={2}
        testResultItem={makeRetry({
          error: {
            actual: "actual value",
            expected: "expected value",
          },
        })}
      />,
    );

    expect(screen.getByTestId("test-result-retries-item-arrow-button")).toBeInTheDocument();
    expect(screen.getByTestId("test-result-retries-item-error-preview")).toHaveTextContent("Comparison");
    expect(screen.queryByTestId("test-result-error")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-result-retries-item-arrow-button"));

    expect(screen.getByTestId("test-result-error")).toHaveTextContent("actual value expected value");
  });
});
