import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttachmentCode } from "./AttachmentCode";

const attachmentItem = (): AttachmentTestStepResult => ({
  type: "attachment",
  link: {
    id: "text-attachment",
    name: "server.log",
    originalFileName: "server.log",
    ext: ".log",
    contentType: "text/plain",
    used: true,
    missed: false,
  },
});

const i18n = (key: string) =>
  ({
    clipboard: "Copy to clipboard",
    clipboardError: "Copy failed",
    clipboardSuccess: "Copied",
  })[key] ?? key;

const renderAttachmentCode = () =>
  render(
    <div role="presentation" onClick={() => parentClick()} onKeyDown={() => parentClick()}>
      <AttachmentCode attachment={{ text: "line 1\nline 2" }} item={attachmentItem()} i18n={i18n} />
    </div>,
  );

const showCopyTooltip = async (button: HTMLElement) => {
  fireEvent.mouseEnter(button.parentElement!.parentElement!);
  await waitFor(() => expect(screen.getByText("Copy to clipboard")).toBeTruthy());
};

const parentClick = vi.fn();
const originalClipboard = navigator.clipboard;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
  parentClick.mockClear();
});

describe("AttachmentCode", () => {
  it("copies attachment text and shows the success tooltip without bubbling the click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderAttachmentCode();

    const button = screen.getByRole("button");
    await showCopyTooltip(button);
    fireEvent.click(button);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("line 1\nline 2"));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("shows the error tooltip when clipboard copying fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    renderAttachmentCode();

    const button = screen.getByRole("button");
    await showCopyTooltip(button);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText("Copy failed")).toBeTruthy());
    expect(parentClick).not.toHaveBeenCalled();
  });
});
