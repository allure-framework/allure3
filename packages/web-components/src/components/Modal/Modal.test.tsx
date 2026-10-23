import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { Modal } from "./index";

const { downloadAttachment, openAttachmentInNewTab } = vi.hoisted(() => ({
  downloadAttachment: vi.fn(),
  openAttachmentInNewTab: vi.fn(),
}));
vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadAttachment,
  openAttachmentInNewTab,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("updates download and open actions when switching between missing and available attachments", () => {
  const props = {
    isModalOpen: true,
    component: <div />,
    translations: {
      tooltipPreview: "Preview",
      tooltipDownload: "Download",
      openInNewTabButton: "Open in new tab",
    },
  };
  const link = { id: "image", ext: ".png", contentType: "image/png", missed: true };
  const view = render(<Modal {...props} data={{ link }} />);
  const download = screen.getByTestId("attachment-download-button");
  const open = screen.getByRole("button", { name: "Open in new tab" });
  expect(download.hasAttribute("disabled")).toBe(true);
  expect(open.hasAttribute("disabled")).toBe(true);
  (download as HTMLButtonElement).click();
  (open as HTMLButtonElement).click();
  expect(downloadAttachment).not.toHaveBeenCalled();
  expect(openAttachmentInNewTab).not.toHaveBeenCalled();

  view.rerender(<Modal {...props} data={{ link: { ...link, missed: false, contentLength: 0 } }} />);
  expect(download.hasAttribute("disabled")).toBe(false);
  expect(open.hasAttribute("disabled")).toBe(false);
  (download as HTMLButtonElement).click();
  (open as HTMLButtonElement).click();
  expect(downloadAttachment).toHaveBeenCalledWith("image", ".png", "image/png");
  expect(openAttachmentInNewTab).toHaveBeenCalledWith("image", ".png", "image/png");
});
