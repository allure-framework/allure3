import { fetchFromUrl } from "@allurereport/web-commons";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { attachmentType, fetchAttachment } from "../../src/utils/attachments.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("attachments");
  await label("coverage", "attachments");
});

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchFromUrl: vi.fn(),
}));

afterEach(() => {
  vi.mocked(fetchFromUrl).mockReset();
  vi.restoreAllMocks();
});

describe("utils > attachments", () => {
  beforeEach(async () => {
    await story("attachmentType");
  });
  it("detects table attachments from parameterized CSV and TSV content types", () => {
    expect(attachmentType("text/csv; charset=utf-8")).toEqual({ type: "table", icon: "csv" });
    expect(attachmentType("text/tab-separated-values; charset=utf-8")).toEqual({ type: "table", icon: "table" });
  });

  it("detects image attachments including webp", () => {
    expect(attachmentType("image/webp")).toEqual({ type: "image", icon: "file" });
  });
});

describe.each([
  { contentType: "text/plain", result: { text: "payload" } },
  { contentType: "image/png", result: { img: "blob:preview", id: "attachment" } },
  { contentType: "video/mp4", result: { src: "blob:preview", id: "attachment", contentType: "video/mp4" } },
])("fetchAttachment ($contentType)", ({ contentType, result }) => {
  beforeEach(async () => {
    await story("fetchAttachment");
  });

  it.each([404, 500])("rejects HTTP %i before reading the error body or creating a preview URL", async (status) => {
    const response = new Response("server error page", { status });
    vi.mocked(fetchFromUrl).mockResolvedValue(response);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");

    await expect(fetchAttachment("attachment", ".dat", contentType)).rejects.toThrow("Failed to fetch");

    expect(response.bodyUsed).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("decodes successful responses using the existing preview format", async () => {
    const response = new Response("payload", { headers: { "Content-Type": contentType } });
    vi.mocked(fetchFromUrl).mockResolvedValue(response);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");

    await expect(fetchAttachment("attachment", ".dat", contentType)).resolves.toEqual(result);

    expect(response.bodyUsed).toBe(true);
    if (contentType === "text/plain") {
      expect(createObjectURL).not.toHaveBeenCalled();
    } else {
      expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(expect.any(Blob));
    }
  });
});
