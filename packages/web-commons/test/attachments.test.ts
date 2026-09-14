import { afterEach, describe, expect, it, vi } from "vitest";

import { attachmentType, blobAttachment } from "../src/attachments.js";

describe("attachmentType", () => {
  it("maps text/markdown to markdown", () => {
    expect(attachmentType("text/markdown")).toBe("markdown");
  });

  it("keeps text/plain as text", () => {
    expect(attachmentType("text/plain")).toBe("text");
  });

  it("maps text/html to html", () => {
    expect(attachmentType("text/html")).toBe("html");
  });

  it("recognizes HTTP Exchange attachments", () => {
    expect(attachmentType("application/vnd.allure.http+json")).toBe("http");
    expect(attachmentType("application/vnd.allure.http+json; charset=utf-8")).toBe("http");
  });

  it("recognizes Playwright trace attachments as archives", () => {
    expect(attachmentType("application/vnd.allure.playwright-trace")).toBe("archive");
  });
});

describe("blobAttachment", () => {
  afterEach(() => {
    delete (globalThis as any).allureReportDataReady;
    delete (globalThis as any).allureReportData;
    vi.restoreAllMocks();
  });

  it("downloads Playwright traces with zip content type without changing bytes", async () => {
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff]);
    const blob = { type: "application/zip" } as Blob;
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "data/attachments/trace-id.zip": content.toString("base64"),
    };

    const result = await blobAttachment("trace-id", ".zip", "application/vnd.allure.playwright-trace");

    expect(result).toBe(blob);
    expect(fetch).toHaveBeenCalledWith(`data:application/zip;base64,${content.toString("base64")}`);
  });
});
