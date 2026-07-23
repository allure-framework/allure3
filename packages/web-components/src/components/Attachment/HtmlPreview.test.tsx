import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HtmlPreview, getIframeContentHeight } from "./HtmlPreview";

afterEach(() => {
  cleanup();
});

/**
 * jsdom has no real layout engine: `scrollHeight` / `getBoundingClientRect()`
 * always report 0 for every element, and navigating an <iframe> to a
 * `blob:` URL does not actually load attachment content into
 * `contentDocument` the way a real browser would. Both of these are true
 * in Allure's own existing suite too (see HttpAttachment.test.tsx, which
 * never asserts real pixel sizes).
 *
 * So instead of asserting real rendered heights, these tests stub
 * `iframe.contentDocument` with a synthetic document whose
 * `scrollHeight` / `getBoundingClientRect` report the height we want to
 * simulate, then assert the behavior we actually changed: does the
 * onLoad handler correctly apply a measured height for the inline
 * preview, and correctly skip doing so inside the fullscreen attachment
 * modal (where the CSS fix in this PR makes `height: 100%` the correct
 * behavior instead)?
 */
const stubIframeContentHeight = (iframe: HTMLIFrameElement, height: number) => {
  const fakeDoc = document.implementation.createHTMLDocument("stub");
  Object.defineProperty(fakeDoc.documentElement, "scrollHeight", { value: height, configurable: true });
  Object.defineProperty(fakeDoc.body, "scrollHeight", { value: height, configurable: true });
  vi.spyOn(fakeDoc.body, "getBoundingClientRect").mockReturnValue({ height } as DOMRect);
  Object.defineProperty(iframe, "contentDocument", { value: fakeDoc, configurable: true });
};

describe("HtmlPreview", () => {
  it("renders nothing when the attachment has no text", () => {
    const { container } = render(<HtmlPreview attachment={{ text: "" }} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a sandboxed iframe without allow-scripts for html attachments", () => {
    render(<HtmlPreview attachment={{ text: "<html><body><p>hello</p></body></html>" }} />);

    const iframe = screen.getByTestId("html-attachment-iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(iframe.src.startsWith("blob:")).toBe(true);
  });

  it("defaults the iframe to height 100% before the content has loaded", () => {
    render(<HtmlPreview attachment={{ text: "<html><body><p>hello</p></body></html>" }} />);

    const iframe = screen.getByTestId("html-attachment-iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("height")).toBe("100%");
  });

  it("measures and applies the content height on load when NOT inside the fullscreen modal", () => {
    render(<HtmlPreview attachment={{ text: "<html><body><p>hello</p></body></html>" }} />);

    const iframe = screen.getByTestId("html-attachment-iframe") as HTMLIFrameElement;
    stubIframeContentHeight(iframe, 958);

    fireEvent.load(iframe);

    expect(iframe.getAttribute("height")).toBe("958");
  });

  it("does NOT override the iframe height when rendered inside the fullscreen attachment modal", () => {
    const { container } = render(
      <div className="styles_modal-data-component__abc123">
        <HtmlPreview attachment={{ text: "<html><body><p>hello</p></body></html>" }} />
      </div>,
    );

    const iframe = screen.getByTestId("html-attachment-iframe") as HTMLIFrameElement;
    stubIframeContentHeight(iframe, 958);

    fireEvent.load(iframe);

    expect(iframe.getAttribute("height")).toBe("100%");
    expect(container.querySelector("[data-testid='html-attachment-iframe']")).toBe(iframe);
  });

  it("re-measures on every load event, so a dynamically-changing attachment is not stuck at its first measured height", () => {
    render(<HtmlPreview attachment={{ text: "<html><body><p>hello</p></body></html>" }} />);
    const iframe = screen.getByTestId("html-attachment-iframe") as HTMLIFrameElement;

    stubIframeContentHeight(iframe, 300);
    fireEvent.load(iframe);
    expect(iframe.getAttribute("height")).toBe("300");

    stubIframeContentHeight(iframe, 700);
    fireEvent.load(iframe);
    expect(iframe.getAttribute("height")).toBe("700");
  });
});

describe("getIframeContentHeight", () => {
  it("returns the larger of the body's rendered height and its scrollHeight", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;

    Object.defineProperty(doc.body, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(doc.documentElement, "scrollHeight", { value: 200, configurable: true });
    vi.spyOn(doc.body, "getBoundingClientRect").mockReturnValue({ height: 120 } as DOMRect);

    // max(bodyRect=120, max(bodyScroll=500, docScroll=200)=500) = 500
    expect(getIframeContentHeight(iframe)).toBe(500);

    iframe.remove();
  });

  it("returns 0 when the iframe has no accessible content document", () => {
    const iframe = document.createElement("iframe");
    // Not appended to the DOM: contentDocument is null in jsdom in this state.
    expect(getIframeContentHeight(iframe)).toBe(0);
  });
});
