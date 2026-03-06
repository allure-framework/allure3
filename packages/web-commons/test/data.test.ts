import { afterEach, describe, expect, it } from "vitest";

import { loadReportData } from "../src/data.js";

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

  it("should resolve using windows-style key for legacy reports", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {
      "widgets\\default\\tree.json": "dHJlZQ==",
    };

    await expect(loadReportData("widgets/default/tree.json")).resolves.toBe("dHJlZQ==");
  });

  it("should throw expected error when data is missing", async () => {
    (globalThis as any).allureReportDataReady = true;
    (globalThis as any).allureReportData = {};

    await expect(loadReportData("widgets/default/tree.json")).rejects.toThrow(
      'Data "widgets/default/tree.json" not found!',
    );
  });
});
