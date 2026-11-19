// @vitest-environment jsdom
import type { DefaultTestStepResult } from "@allurereport/core-api";
import { epic, feature, label, step, story } from "allure-js-commons";
import { createElement, render } from "preact";
import { act } from "preact/test-utils";
import type { ReportFixtureResult } from "types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TestResultError } from "../src/components/TestResult/TestResultError/index.js";
import { TestResultStep } from "../src/components/TestResult/TestResultSteps/testResultStep.js";

const { openModal } = vi.hoisted(() => ({ openModal: vi.fn() }));

vi.mock("@allurereport/web-components", async (importOriginal) => {
  const { TestResultError: TestResultErrorBlock } =
    await importOriginal<typeof import("@allurereport/web-components")>();
  const passthrough = ({ children, tag, ...rest }: { "children"?: unknown; "tag"?: string; "data-testid"?: string }) =>
    createElement(tag ?? "span", { "data-testid": rest["data-testid"] }, children as never);

  return {
    allureIcons: new Proxy({}, { get: (_, key) => String(key) }),
    Attachment: () => null,
    Button: ({ text, onClick, ...rest }: { text: string; onClick: () => void }) =>
      createElement("button", { onClick, "data-testid": (rest as Record<string, string>)["data-testid"] }, text),
    Code: passthrough,
    IconButton: () => null,
    LazyComponent: () => null,
    LinkifiedText: ({ text }: { text: string }) => createElement("span", null, text),
    Menu: () => null,
    Spinner: () => null,
    SvgIcon: () => null,
    TestResultError: TestResultErrorBlock,
    Text: passthrough,
    TooltipWrapper: passthrough,
  };
});
vi.mock("@/stores/locale", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/Modal", () => ({ openModal, isModalOpen: { value: false } }));

beforeEach(async () => {
  await epic("coverage");
  await feature("test-result-errors");
  await label("coverage", "test-result-errors");
});

const container = document.createElement("div");
document.body.append(container);

afterEach(async () => {
  await act(() => render(null, container));
  vi.clearAllMocks();
});

const query = (testId: string) => container.querySelectorAll(`[data-testid="${testId}"]`);

const failedStep = (overrides: Partial<DefaultTestStepResult> = {}): DefaultTestStepResult => ({
  type: "step",
  name: "failed step",
  status: "failed",
  parameters: [],
  steps: [],
  message: "boom",
  trace: "at step (spec.ts:1)",
  ...overrides,
});

const expand = async (header: Element) => {
  await act(async () => (header as HTMLElement).click());
};

describe("TestResultError", () => {
  beforeEach(async () => {
    await story("error block");
  });

  it("renders ANSI colours as HTML instead of raw escape codes", async () => {
    await act(() => render(createElement(TestResultError, { message: "\u001b[31mred\u001b[39m text" }), container));

    const message = query("test-result-error-message")[0];

    expect(message.textContent).toBe("red text");
    expect(message.innerHTML).not.toContain("\u001b");
    expect(message.querySelector("span[style]")).not.toBeNull();
  });

  it("shows the trace right away when there is no message", async () => {
    await act(() => render(createElement(TestResultError, { trace: "at only trace (spec.ts:2)" }), container));

    expect(container.textContent).toContain("no-message-provided");
    expect(query("test-result-error-trace")[0].textContent).toBe("at only trace (spec.ts:2)");
  });

  it("opens the expected/actual comparison in the modal", async () => {
    await act(() =>
      render(createElement(TestResultError, { message: "mismatch", expected: "1", actual: "2" }), container),
    );

    await act(async () => (query("test-result-diff-button")[0] as HTMLElement).click());

    expect(openModal).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: "comparison", data: { expected: "1", actual: "2" } }),
    );
  });
});

describe("TestResultStep errors", () => {
  beforeEach(async () => {
    await story("errors inside steps");
  });

  it("renders the step error once, in the deepest step that owns it", async () => {
    const inner = failedStep({ name: "inner" });
    const outer = failedStep({ name: "outer", steps: [inner], hasSimilarErrorInSubSteps: true });

    await act(() => render(createElement(TestResultStep, { item: outer, stepIndex: 1 }), container));
    await step("Expand the outer step", () => expand(query("test-result-step-header")[0]));
    expect(query("test-result-error")).toHaveLength(0);

    await step("Expand the inner step", () => expand(query("test-result-step-header")[1]));
    expect(query("test-result-error")).toHaveLength(1);
    expect(query("test-result-error-message")[0].textContent).toBe("boom");
  });

  it("makes a step with only an error expandable", async () => {
    await act(() => render(createElement(TestResultStep, { item: failedStep(), stepIndex: 1 }), container));
    await expand(query("test-result-step-header")[0]);

    expect(query("test-result-error")).toHaveLength(1);
  });

  it("shows failed and broken substep counters in the step row", async () => {
    const item = failedStep({
      steps: [failedStep(), failedStep({ status: "broken" }), failedStep({ status: "passed", message: undefined })],
      hasSimilarErrorInSubSteps: true,
    });

    await act(() => render(createElement(TestResultStep, { item, stepIndex: 1 }), container));

    expect(query("test-result-step-failed-count")[0].textContent).toBe("1");
    expect(query("test-result-step-broken-count")[0].textContent).toBe("1");
  });

  it("renders the fixture error with its diff", async () => {
    const fixture: ReportFixtureResult = {
      id: "fixture",
      type: "before",
      name: "connect",
      status: "broken",
      error: { message: "connection refused", expected: "open", actual: "closed" },
      steps: [],
    };

    await act(() => render(createElement(TestResultStep, { item: fixture, stepIndex: 1 }), container));
    await expand(query("test-result-step-header")[0]);

    expect(query("test-result-error-message")[0].textContent).toBe("connection refused");
    expect(query("test-result-diff-button")).toHaveLength(1);
  });
});
