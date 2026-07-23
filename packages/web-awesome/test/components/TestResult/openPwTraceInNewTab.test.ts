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
    const loadTrace = vi.fn().mockResolvedValue(new Blob(["trace"]));
    vi.spyOn(window, "open").mockReturnValue(null);

    const result = openPlaywrightTraceInNewTab(loadTrace);

    expect(result).toBe(false);
    expect(loadTrace).not.toHaveBeenCalled();
  });

  it("sends trace message after the trace viewer has time to bootstrap", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const blob = new Blob(["trace"]);
    const loadTrace = vi.fn().mockResolvedValue(blob);
    const postMessage = vi.fn();
    const popup = {
      document: { write: vi.fn(), close: vi.fn() },
      postMessage,
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    const result = openPlaywrightTraceInNewTab(loadTrace);

    expect(result).toBe(true);
    expect(loadTrace).toHaveBeenCalledTimes(1);
    expect(popup.document.write).toHaveBeenCalledTimes(1);
    expect(popup.document.close).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toBe("");
    expect(postMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(749);
    expect(popup.location.href).toBe("");
    expect(postMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(popup.location.href).toBe("https://trace.playwright.dev/");
    expect(postMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_749);
    expect(postMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      { method: "load", params: { trace: blob } },
      "https://trace.playwright.dev",
    );

    await vi.advanceTimersByTimeAsync(30_000);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the loading page open while trace attachment is still loading", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    let resolveTrace!: (blob: Blob) => void;
    const loadTrace = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveTrace = resolve;
        }),
    );
    const popup = {
      document: { write: vi.fn(), close: vi.fn() },
      postMessage: vi.fn(),
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPlaywrightTraceInNewTab(loadTrace);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(popup.document.write).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toBe("");
    expect(popup.postMessage).not.toHaveBeenCalled();

    resolveTrace(new Blob(["trace"]));
    await vi.advanceTimersByTimeAsync(0);

    expect(popup.location.href).toBe("https://trace.playwright.dev/");
  });

  it("shows an error page when trace attachment loading fails", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const popup = {
      document: { write: vi.fn(), close: vi.fn() },
      postMessage: vi.fn(),
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPlaywrightTraceInNewTab(() => Promise.reject(new Error("fetch failed")));
    await vi.advanceTimersByTimeAsync(0);

    expect(popup.document.write).toHaveBeenCalledTimes(2);
    expect(popup.document.write).toHaveBeenLastCalledWith(expect.stringContaining("Failed to load Playwright trace"));
    expect(popup.location.href).toBe("");
    expect(popup.postMessage).not.toHaveBeenCalled();
  });

  it("does not send trace when popup is already closed", async () => {
    const { openPlaywrightTraceInNewTab } = await import("@/components/TestResult/TrPwTraces/openPwTraceInNewTab");
    const postMessage = vi.fn();
    const popup = {
      document: { write: vi.fn(), close: vi.fn() },
      postMessage,
      location: { href: "" },
      focus: vi.fn(),
      closed: false,
    } as unknown as Window & { closed: boolean };
    vi.spyOn(window, "open").mockReturnValue(popup);

    openPlaywrightTraceInNewTab(() => Promise.resolve(new Blob(["trace"])));
    expect(postMessage).not.toHaveBeenCalled();

    popup.closed = true;
    await vi.advanceTimersByTimeAsync(2_500);
    expect(popup.location.href).toBe("");
    expect(postMessage).not.toHaveBeenCalled();
  });
});
