import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpAttachment } from "./HttpAttachment";

const attachmentItem = (name = "HTTP exchange"): AttachmentTestStepResult => ({
  type: "attachment",
  link: {
    id: "http-exchange",
    name,
    originalFileName: "http-exchange.httpexchange",
    ext: ".httpexchange",
    contentType: "application/vnd.allure.http+json",
    used: true,
    missed: false,
  },
});

const renderHttpAttachment = (http: unknown) =>
  render(<HttpAttachment attachment={{ http }} item={attachmentItem()} />);

afterEach(() => {
  cleanup();
});

describe("HttpAttachment", () => {
  it("renders request and response summary with masked redacted values", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      start: 1710000186400,
      stop: 1710000186487,
      request: {
        method: "POST",
        url: "https://api.example.com/v1/orders/42?dryRun=true",
        httpVersion: "HTTP/1.1",
        query: [{ name: "dryRun", value: "true" }],
        headers: [
          { name: "authorization", value: "__ALLURE_REDACTED__" },
          { name: "content-type", value: "application/json" },
        ],
        body: {
          contentType: "application/json",
          encoding: "utf8",
          value: '{"name":"demo"}',
          size: 15,
        },
      },
      response: {
        status: 201,
        statusText: "Created",
        headers: [{ name: "content-type", value: "application/json" }],
        body: {
          contentType: "application/json",
          encoding: "utf8",
          value: '{"id":42}',
          size: 9,
        },
      },
    });

    expect(screen.getAllByText("POST")).toHaveLength(1);
    expect(screen.getAllByText("https://api.example.com/v1/orders/42?dryRun=true")).toHaveLength(1);
    expect(screen.getByText("Request")).toBeTruthy();
    expect(screen.getByText("Response")).toBeTruthy();
    expect(screen.getAllByText("201 Created")).toHaveLength(2);
    expect(screen.getAllByText("87 ms")).toHaveLength(2);
    expect(within(document.querySelector("[data-http-panel='request']")!).queryByText("POST")).toBeNull();
    expect(
      within(document.querySelector("[data-http-panel='request']")!).queryByText(
        "https://api.example.com/v1/orders/42?dryRun=true",
      ),
    ).toBeNull();
    expect(screen.getByText("Query (1)")).toBeTruthy();
    expect(screen.getByText("Headers (2)")).toBeTruthy();

    fireEvent.click(screen.getByText("Query (1)"));
    fireEvent.click(screen.getByText("Headers (2)"));

    const queryGroup = screen.getByText("Query (1)").closest("details")!;
    expect(within(queryGroup).getByText("Name")).toBeTruthy();
    expect(within(queryGroup).getByText("Value")).toBeTruthy();
    expect(screen.getByText("dryRun")).toBeTruthy();
    expect(screen.getByText("*****")).toBeTruthy();
    expect(screen.queryByText("__ALLURE_REDACTED__")).toBeNull();
    expect(screen.getByText('{"name":"demo"}')).toBeTruthy();
  });

  it("renders HTML bodies as source text and not executable markup", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://example.com",
      },
      response: {
        status: 200,
        statusText: "OK",
        body: {
          contentType: "text/html",
          encoding: "utf8",
          value: "<script>window.__httpAttachmentXss = true</script>",
        },
      },
    });

    expect(screen.getByText("<script>window.__httpAttachmentXss = true</script>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps zero response status visible", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://api.example.com/opaque",
      },
      response: {
        status: 0,
      },
    });

    expect(screen.getByText("Response")).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("hides response section when response has no captured data", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://api.example.com/no-response-details",
      },
      response: {},
    });

    expect(screen.queryByText("Response")).toBeNull();
  });

  it("renders base64 images and binary fallback", () => {
    const { unmount } = renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://example.com/image.png",
      },
      response: {
        status: 200,
        statusText: "OK",
        body: {
          contentType: "image/png",
          encoding: "base64",
          value: "iVBORw0KGgo=",
          size: 8,
        },
      },
    });

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(screen.queryByRole("link", { name: "Download response" })).toBeNull();
    expect(screen.queryByText("Request")).toBeNull();

    unmount();

    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://example.com/file.bin",
      },
      response: {
        status: 200,
        statusText: "OK",
        body: {
          contentType: "application/octet-stream",
          encoding: "base64",
          value: "AAECAw==",
          size: 4,
        },
      },
    });

    expect(screen.getByText("No inline view for application/octet-stream.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Download response" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("renders structured form, multipart, trailers, and errors", () => {
    const { unmount } = renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "POST",
        url: "https://api.example.com/form",
        body: {
          contentType: "application/x-www-form-urlencoded",
          form: [{ name: "field", value: "value" }],
        },
      },
    });

    expect(screen.getByText("Form (1)")).toBeTruthy();
    expect(screen.getByText("field")).toBeTruthy();
    expect(screen.getByText("value")).toBeTruthy();

    unmount();

    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "POST",
        url: "https://api.example.com/upload",
        body: {
          contentType: "multipart/form-data",
          parts: [
            {
              name: "metadata",
              contentType: "application/json",
              headers: [{ name: "authorization", value: "__ALLURE_REDACTED__" }],
              value: '{"ok":true}',
            },
          ],
        },
        trailers: [{ name: "grpc-status", value: "0" }],
      },
      response: {
        status: 500,
        statusText: "Internal Server Error",
        trailers: [{ name: "request-id", value: "abc-123" }],
      },
      error: {
        name: "FetchError",
        message: "socket hang up",
        stack: "FetchError: socket hang up",
      },
    });

    expect(screen.getByText("Parts (1)")).toBeTruthy();
    expect(screen.getByText("metadata")).toBeTruthy();
    const metadataPart = screen.getByText("metadata").closest("[data-http-part]")!;
    expect(within(metadataPart).getByText("Headers")).toBeTruthy();
    expect(within(metadataPart).getByText("authorization")).toBeTruthy();
    expect(within(metadataPart).getByLabelText("Value is masked")).toBeTruthy();
    expect(screen.queryByText("__ALLURE_REDACTED__")).toBeNull();
    expect(screen.getByText('{"ok":true}')).toBeTruthy();

    screen.getAllByText("Trailers (1)").forEach((summary) => fireEvent.click(summary));

    expect(screen.getByText("grpc-status")).toBeTruthy();
    expect(screen.getByText("request-id")).toBeTruthy();
    expect(screen.getByText("FetchError")).toBeTruthy();
    expect(screen.getByText("socket hang up")).toBeTruthy();
  });

  it("shows an invalid attachment message when request is missing", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      response: {
        status: 200,
      },
    });

    expect(screen.getByText("Invalid HTTP Exchange attachment: request is missing.")).toBeTruthy();
  });

  it("toggles JSON body pretty view", () => {
    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "POST",
        url: "https://api.example.com",
        body: {
          contentType: "application/json",
          encoding: "utf8",
          value: '{"name":"demo"}',
        },
      },
    });

    const codeBlock = screen.getByTestId("code-attachment-content");
    expect(codeBlock.textContent).toBe('{"name":"demo"}');

    const prettyButton = screen.getByRole("button", { name: "Pretty" });
    expect(prettyButton).toBeTruthy();

    fireEvent.click(prettyButton);

    expect(screen.getByRole("button", { name: "Original" })).toBeTruthy();
    expect(screen.getByTestId("code-attachment-content").textContent).toBe('{\n  "name": "demo"\n}');
  });

  it("copies text body values and hides copy button for non-text bodies", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { unmount } = renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "POST",
        url: "https://api.example.com",
        body: {
          contentType: "text/plain",
          encoding: "utf8",
          value: "hello world",
        },
      },
    });

    const copyButton = screen.getByRole("button", { name: "Copy" });
    expect(copyButton).toBeTruthy();
    fireEvent.click(copyButton);
    expect(writeText).toHaveBeenCalledWith("hello world");

    unmount();

    const imageView = renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://api.example.com/image.png",
      },
      response: {
        status: 200,
        body: {
          contentType: "image/png",
          encoding: "base64",
          value: "iVBORw0KGgo=",
        },
      },
    });

    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    imageView.unmount();

    const base64JsonView = renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "POST",
        url: "https://api.example.com/base64-json",
        body: {
          contentType: "application/json",
          encoding: "base64",
          value: "eyJuYW1lIjoiZGVtbyJ9",
        },
      },
    });

    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pretty" })).toBeNull();
    base64JsonView.unmount();

    renderHttpAttachment({
      schemaVersion: 1,
      request: {
        method: "GET",
        url: "https://api.example.com",
      },
    });

    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();

    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });
});
