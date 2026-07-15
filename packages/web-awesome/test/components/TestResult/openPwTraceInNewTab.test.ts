import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("openPwTraceInNewTab");
  await label("coverage", "ui-components");
});

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

  it("sends trace message after the trace viewer has time to bootstrap", async () => {
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
    expect(postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(postMessage).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("does not send trace when popup is already closed", async () => {
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
    expect(postMessage).not.toHaveBeenCalled();

    popup.closed = true;
    vi.advanceTimersByTime(1_000);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
