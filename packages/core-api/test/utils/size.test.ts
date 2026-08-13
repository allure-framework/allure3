import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HEAVY_ATTACHMENT_BYTES,
  LARGE_REPORT_SEVERE_BYTES,
  LARGE_REPORT_WARN_BYTES,
  estimateBase64EmbeddedSize,
  formatByteSize,
  isHeavyAttachment,
  warnIfLargeSingleFileReport,
} from "../../src/index.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("size");
  await label("coverage", "report-data-model");
});

describe("formatByteSize", () => {
  it("formats zero and sub-kilobyte sizes", () => {
    expect(formatByteSize(0)).toBe("0 bytes");
    expect(formatByteSize(512)).toBe("512 bytes");
  });

  it("formats KB, MB, and GB with 1024-based units", () => {
    expect(formatByteSize(1024)).toBe("1.00 KB");
    expect(formatByteSize(HEAVY_ATTACHMENT_BYTES)).toBe("1.00 MB");
    expect(formatByteSize(LARGE_REPORT_WARN_BYTES)).toBe("50.00 MB");
    expect(formatByteSize(1024 ** 3)).toBe("1.00 GB");
  });
});

describe("isHeavyAttachment", () => {
  it("returns false for missing or non-finite sizes", () => {
    expect(isHeavyAttachment(undefined)).toBe(false);
    expect(isHeavyAttachment(null)).toBe(false);
    expect(isHeavyAttachment(Number.NaN)).toBe(false);
  });

  it("uses the default 1 MiB threshold", () => {
    expect(isHeavyAttachment(HEAVY_ATTACHMENT_BYTES - 1)).toBe(false);
    expect(isHeavyAttachment(HEAVY_ATTACHMENT_BYTES)).toBe(true);
  });

  it("accepts a custom threshold", () => {
    expect(isHeavyAttachment(100, 100)).toBe(true);
    expect(isHeavyAttachment(99, 100)).toBe(false);
  });
});

describe("estimateBase64EmbeddedSize", () => {
  it("estimates 4/3 expansion", () => {
    expect(estimateBase64EmbeddedSize(3)).toBe(4);
    expect(estimateBase64EmbeddedSize(HEAVY_ATTACHMENT_BYTES)).toBe(Math.ceil((HEAVY_ATTACHMENT_BYTES * 4) / 3));
  });
});

describe("warnIfLargeSingleFileReport", () => {
  it("does not warn below the soft threshold", () => {
    const log = vi.fn();

    warnIfLargeSingleFileReport(LARGE_REPORT_WARN_BYTES - 1, log);

    expect(log).not.toHaveBeenCalled();
  });

  it("warns at the soft threshold", () => {
    const log = vi.fn();

    warnIfLargeSingleFileReport(LARGE_REPORT_WARN_BYTES, log);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("is large");
    expect(log.mock.calls[0][0]).toContain("50.00 MB");
  });

  it("uses the severe message at the hard threshold", () => {
    const log = vi.fn();

    warnIfLargeSingleFileReport(LARGE_REPORT_SEVERE_BYTES, log);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("very large");
    expect(log.mock.calls[0][0]).toContain("100.00 MB");
  });
});
