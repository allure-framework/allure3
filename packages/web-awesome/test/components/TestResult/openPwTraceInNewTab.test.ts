import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("components > TestResult > openPlaywrightTraceInNewTab", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns false when popup is blocked", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    vi.spyOn(window, "open").mockReturnValue(null);

    const result = openPlaywrightTraceInNewTab(new Blob(["trace"]));

    expect(result).toBe(false);
  });

  it("sends trace message immediately and retries once", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const postMessage = vi.fn();
    const popup = {
      postMessage,
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    const result = openPlaywrightTraceInNewTab(new Blob(["trace"]));

    expect(result).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    expect(postMessage).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(30_000);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("does not send delayed retry when popup is already closed", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const postMessage = vi.fn();
    const popup = {
      postMessage,
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window & { closed: boolean };
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPlaywrightTraceInNewTab(new Blob(["trace"]));
    expect(postMessage).toHaveBeenCalledTimes(1);

    popup.closed = true;
    vi.advanceTimersByTime(300);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
