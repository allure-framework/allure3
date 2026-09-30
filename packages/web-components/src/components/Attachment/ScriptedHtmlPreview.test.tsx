import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { HTML_PREVIEW_RESIZE_MESSAGE_TYPE, createHtmlPreviewDocument } from "./htmlPreviewDocument";
import { ScriptedHtmlPreview } from "./ScriptedHtmlPreview";

afterEach(cleanup);

describe("createHtmlPreviewDocument", () => {
  it("keeps the attachment scripts and styles", () => {
    const result = createHtmlPreviewDocument(
      "<html><head><style>p{color:red}</style></head><body><script>window.ran=1</script></body></html>",
      "token",
      false,
    );

    expect(result).toContain("<style>p{color:red}</style>");
    expect(result).toContain("window.ran=1");
  });

  it("locks the document down with its own CSP and drops base, refresh and foreign CSP", () => {
    const result = createHtmlPreviewDocument(
      `<html><head><base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test/"><meta http-equiv="Content-Security-Policy" content="default-src *"></head><body></body></html>`,
      "token",
      false,
    );

    expect(result).not.toContain("evil.test");
    expect(result).not.toContain("default-src *");
    expect(result).toContain("connect-src 'none'");
    expect(result).toContain('name="referrer"');
  });

  it("adds dark theme styles only for the dark theme", () => {
    expect(createHtmlPreviewDocument("<p>x</p>", "token", true)).toContain("#1c1c1e");
    expect(createHtmlPreviewDocument("<p>x</p>", "token", false)).not.toContain("#1c1c1e");
  });
});

describe("ScriptedHtmlPreview", () => {
  it("runs scripts in an opaque origin sandbox", async () => {
    render(<ScriptedHtmlPreview attachment={{ text: "<html><body><script>1</script></body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;

    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("srcdoc")).toContain("<script>1</script>");
  });

  it("sizes the iframe from the resize message of its own document", async () => {
    render(<ScriptedHtmlPreview attachment={{ text: "<html><body>row</body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;
    const token = /const token = "([^"]+)"/.exec(iframe.getAttribute("srcdoc") ?? "")?.[1];
    const send = (messageToken: string | undefined, source: MessageEventSource | null) =>
      fireEvent(
        window,
        new MessageEvent("message", {
          data: { type: HTML_PREVIEW_RESIZE_MESSAGE_TYPE, token: messageToken, height: 640 },
          source,
        }),
      );

    send("wrong", iframe.contentWindow);
    send(token, null);
    expect(iframe.getAttribute("height")).toBeNull();

    send(token, iframe.contentWindow);
    await waitFor(() => expect(iframe.getAttribute("height")).toBe("640"));
  });
});
