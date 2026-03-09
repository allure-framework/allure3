import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  canOpenInNewTab: boolean;
  failFetch?: boolean;
};

const setup = async ({ canOpenInNewTab, failFetch }: SetupOptions) => {
  vi.resetModules();

  const fetchFromUrl = failFetch
    ? vi.fn().mockRejectedValue(new Error("fetch failed"))
    : vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(["trace"])),
      });
  const openModal = vi.fn();
  const closeModal = vi.fn();
  const openPlaywrightTraceInNewTab = vi.fn().mockReturnValue(canOpenInNewTab);

  vi.doMock("@allurereport/web-commons", () => ({
    fetchFromUrl,
  }));
  vi.doMock("@allurereport/web-components", () => ({
    Button: ({ onClick, text }: { onClick?: () => void; text?: string }) => <button onClick={onClick}>{text}</button>,
    Text: ({ children }: { children: unknown }) => <div>{children}</div>,
    TooltipWrapper: ({ children }: { children: unknown }) => <div>{children}</div>,
    IconButton: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>open trace</button>,
    allureIcons: { lineArrowsExpand3: "lineArrowsExpand3" },
  }));
  vi.doMock("@/stores", () => ({
    useI18n: () => ({ t: (key: string) => key }),
  }));
  vi.doMock("@/stores/modal", () => ({
    openModal,
    closeModal,
  }));
  vi.doMock("@/components/TestResult/TrPwTraces/openPwTraceInNewTab", () => ({ openPlaywrightTraceInNewTab }));

  const { PwTraceButton } = await import("@/components/TestResult/TrPwTraces/PwTraceButton");

  render(
    <PwTraceButton
      link={{
        id: "trace-id",
        ext: ".zip",
        name: "trace",
        contentType: "application/vnd.allure.playwright-trace",
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "open trace" }));

  return { fetchFromUrl, openModal, closeModal, openPlaywrightTraceInNewTab };
};

describe("components > TestResult > PwTraceButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens trace viewer in new tab and does not open modal", async () => {
    const { openModal, openPlaywrightTraceInNewTab } = await setup({
      canOpenInNewTab: true,
    });

    await waitFor(() => {
      expect(openPlaywrightTraceInNewTab).toHaveBeenCalledTimes(1);
    });

    expect(openModal).not.toHaveBeenCalled();
  });

  it("shows popup-blocked modal when new tab cannot be opened", async () => {
    const { openModal, openPlaywrightTraceInNewTab } = await setup({
      canOpenInNewTab: false,
    });

    await waitFor(() => {
      expect(openModal).toHaveBeenCalledTimes(1);
    });

    expect(openPlaywrightTraceInNewTab).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Playwright Trace Viewer | trace.zip",
      }),
    );
  });

  it("shows error modal when trace attachment fetch fails", async () => {
    const { openModal, openPlaywrightTraceInNewTab } = await setup({
      canOpenInNewTab: true,
      failFetch: true,
    });

    await waitFor(() => {
      expect(openModal).toHaveBeenCalledTimes(1);
    });

    expect(openPlaywrightTraceInNewTab).not.toHaveBeenCalled();
  });
});
