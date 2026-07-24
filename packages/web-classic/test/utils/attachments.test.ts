import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { attachmentType } from "../../src/utils/attachments.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("attachments");
  await story("attachmentType");
  await label("coverage", "attachments");
});

describe("utils > attachments", () => {
  it("detects table attachments from parameterized CSV and TSV content types", () => {
    expect(attachmentType("text/csv; charset=utf-8")).toEqual({ type: "table", icon: "csv" });
    expect(attachmentType("text/tab-separated-values; charset=utf-8")).toEqual({ type: "table", icon: "table" });
  });
});
