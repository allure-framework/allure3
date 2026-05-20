import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("components > TestResult > openPlaywrightTraceInNewTab", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when popup is blocked", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    vi.spyOn(window, "open").mockReturnValue(null);

    const result = openPlaywrightTraceInNewTab("http://localhost:1234/data/attachments/trace.zip?attachment");

    expect(result).toBe(false);
  });

  it("opens Playwright Trace Viewer with trace URL parameter", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const popup = {
      focus: vi.fn(),
    } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);

    const result = openPlaywrightTraceInNewTab("http://localhost:1234/data/attachments/trace.zip?attachment");

    expect(result).toBe(true);
    expect(open).toHaveBeenCalledWith(
      "https://trace.playwright.dev/?trace=http%3A%2F%2Flocalhost%3A1234%2Fdata%2Fattachments%2Ftrace.zip%3Fattachment",
      "_blank",
    );
    expect(popup.focus).toHaveBeenCalledTimes(1);
  });
});
