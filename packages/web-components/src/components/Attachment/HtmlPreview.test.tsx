import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { HtmlPreview } from "./HtmlPreview";
import { HTML_PREVIEW_RESIZE_MESSAGE_TYPE, createHtmlPreviewDocument } from "./htmlPreviewDocument";

const blobs = new Map<string, Blob>();
const readBlob = (url: string | null) =>
  new Promise<string>((resolve, reject) => {
    const blob = blobs.get(url ?? "");
    if (!blob) {
      reject(new Error(`unknown blob url ${url}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

beforeEach(() => {
  let counter = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        const url = `blob:http://localhost/${counter++}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL: (url: string) => {
        blobs.delete(url);
      },
    }),
  );
});

afterEach(() => {
  cleanup();
  blobs.clear();
  vi.unstubAllGlobals();
});

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

describe("HtmlPreview", () => {
  it("runs scripts in an opaque origin sandbox", async () => {
    render(<HtmlPreview attachment={{ text: "<html><body><script>1</script></body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;

    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("srcdoc")).toBeNull();
    expect(iframe.getAttribute("src")).toMatch(/^blob:/);
    expect(await readBlob(iframe.getAttribute("src"))).toContain("<script>1</script>");
  });

  it("revokes the blob URL on unmount", async () => {
    const { unmount } = render(<HtmlPreview attachment={{ text: "<html><body>row</body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;
    const url = iframe.getAttribute("src") as string;
    expect(blobs.has(url)).toBe(true);

    unmount();
    expect(blobs.has(url)).toBe(false);
  });

  it("revokes the blob URL once the frame has loaded", async () => {
    render(<HtmlPreview attachment={{ text: "<html><body>row</body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;
    const url = iframe.getAttribute("src") as string;
    expect(blobs.has(url)).toBe(true);

    fireEvent.load(iframe);
    expect(blobs.has(url)).toBe(false);
  });

  it("sizes the iframe from the resize message of its own document", async () => {
    render(<HtmlPreview attachment={{ text: "<html><body>row</body></html>" }} />);

    const iframe = (await screen.findByTitle("HTML attachment")) as HTMLIFrameElement;
    const token = /const token = "([^"]+)"/.exec(await readBlob(iframe.getAttribute("src")))?.[1];
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
