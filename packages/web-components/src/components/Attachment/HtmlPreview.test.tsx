import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HtmlPreview } from "./HtmlPreview";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const setReadOnlyNumber = (element: Element, property: "scrollHeight" | "offsetHeight", value: number) => {
  Object.defineProperty(element, property, { configurable: true, value });
};

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:html-attachment-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
});

describe("HtmlPreview", () => {
  it("sizes the iframe to the loaded HTML document height", async () => {
    render(
      <HtmlPreview
        attachment={{
          text: "<!DOCTYPE html><html><body><table><tbody><tr><td>row</td></tr></tbody></table></body></html>",
        }}
      />,
    );

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;
    const iframeDocument = document.implementation.createHTMLDocument("HTML attachment");

    setReadOnlyNumber(iframeDocument.body, "scrollHeight", 640);
    setReadOnlyNumber(iframeDocument.body, "offsetHeight", 480);
    setReadOnlyNumber(iframeDocument.documentElement, "scrollHeight", 520);
    setReadOnlyNumber(iframeDocument.documentElement, "offsetHeight", 500);
    vi.spyOn(iframeDocument.body, "getBoundingClientRect").mockReturnValue({ height: 560 } as DOMRect);
    Object.defineProperty(iframe, "contentDocument", { configurable: true, value: iframeDocument });

    fireEvent.load(iframe);

    await waitFor(() => expect(iframe.getAttribute("height")).toBe("640"));
  });
});
