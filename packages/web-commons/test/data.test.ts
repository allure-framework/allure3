import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportFetchError, fetchReportJsonData, loadReportData } from "../src/data.js";

describe("loadReportData", () => {
  afterEach(() => {
    delete (globalThis as any).allureReportDataReady;
    delete (globalThis as any).allureReportData;
  });

  it("should resolve exact key when present", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "widgets/default/tree.json": "dHJlZQ==",
    };

    await expect(loadReportData("widgets/default/tree.json")).resolves.toBe("dHJlZQ==");
  });

  it("should prefer posix key when both posix and windows forms exist", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "widgets/default/tree.json": "cG9zaXg=",
      "widgets\\default\\tree.json": "d2luZG93cw==",
    };

    await expect(loadReportData("widgets/default/tree.json")).resolves.toBe("cG9zaXg=");
  });

  it("should throw expected error when data is missing", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {};

    await expect(loadReportData("widgets/default/tree.json")).rejects.toThrow(
      'Data "widgets/default/tree.json" not found!',
    );
  });

  it("should resolve using windows-style key for legacy reports", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "widgets\\default\\tree.json": "dHJlZQ==",
    };

    await expect(loadReportData("widgets/default/tree.json")).resolves.toBe("dHJlZQ==");
  });

  it("should resolve when value is an empty string (zero-byte attachment)", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "data/attachments/empty.bin": "",
    };

    await expect(loadReportData("data/attachments/empty.bin")).resolves.toBe("");
  });

  it("should resolve empty-string value via posix key normalisation", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "data/attachments/empty.bin": "",
    };

    await expect(loadReportData("data\\attachments\\empty.bin")).resolves.toBe("");
  });
});

describe("fetchReportJsonData", () => {
  afterEach(() => {
    delete (globalThis as any).allureReportDataReady;
    delete (globalThis as any).allureReportData;
    vi.restoreAllMocks();
  });

  it("should throw ReportFetchError with status 404 when key is absent in single-file mode", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {};

    const error = await fetchReportJsonData("widgets/tree-filters.json").catch((e) => e);

    expect(error).toBeInstanceOf(ReportFetchError);
    expect((error as ReportFetchError).response.status).toBe(404);
  });

  it("should return parsed JSON when key is present in single-file mode", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      // base64 of '{"tags":["smoke"]}'
      "widgets/tree-filters.json": Buffer.from('{"tags":["smoke"]}').toString("base64"),
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"tags":["smoke"]}', { status: 200 }));

    const result = await fetchReportJsonData<{ tags: string[] }>("widgets/tree-filters.json");

    expect(result.tags).toEqual(["smoke"]);
  });
});
