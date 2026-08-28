import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import type { AwesomeTestResult } from "types";
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
} as AwesomeTestResult;

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
});
