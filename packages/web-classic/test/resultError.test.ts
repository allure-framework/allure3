// @vitest-environment jsdom

import type { TestResult } from "@allurereport/core-api";
import { createElement, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { TestResultHistoryItem } from "../src/components/TestResult/TestResultHistory/TestResultHistoryItem.js";
import { TestResultRetriesItem } from "../src/components/TestResult/TestResultRetriesView/TestResultRetriesItem.js";

vi.mock("@allurereport/web-components", () => ({
  IconButton: () => null,
  Text: ({ children }) => createElement("span", null, children),
  Code: ({ children, ...props }) => createElement("code", props, children),
  TooltipWrapper: ({ children }) => children,
  allureIcons: {},
}));
vi.mock("@/components/TestResult/TestResultError", () => ({
  TestResultError: ({ message, trace }: { message: string; trace: string }) =>
    createElement("pre", { "data-testid": "error-block" }, `${message}\n${trace}`),
}));
vi.mock("@/components/Tree/TreeItemIcon", () => ({ default: () => null }));
vi.mock("@/components/ArrowButton", () => ({ ArrowButton: () => createElement("span", null, "Expand") }));
vi.mock("@/stores", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/locale", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/time", () => ({ timestampToDate: () => "Now" }));

const result: TestResult = {
  id: "result",
  name: "Failed test",
  status: "failed",
  error: { message: "Nested error message", trace: "Nested error trace" },
  testCaseHash: null,
  parametersHash: "",
  environmentHash: null,
  retryHash: null,
  flaky: false,
  muted: false,
  known: false,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "test", metadata: {} },
};
const container = document.createElement("div");
afterEach(() => act(() => render(null, container)));

it.each(["history", "retry"])("passes the stored error message and trace of a %s result to the error block", (kind) => {
  act(() =>
    render(
      kind === "history"
        ? createElement(TestResultHistoryItem, {
            testResultItem: { ...result, ...result.error, error: undefined, url: "#result" },
          })
        : createElement(TestResultRetriesItem, { testResultItem: result, attempt: 1, totalAttempts: 2 }),
      container,
    ),
  );
  expect(container.querySelector("[data-testid=error-block]")).toBeNull();
  act(() => container.querySelector("span")!.click());
  expect(container.querySelector("[data-testid=error-block]")!.textContent).toBe(
    `${result.error!.message}\n${result.error!.trace}`,
  );
});
