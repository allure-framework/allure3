import type { ReportTestResult } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { CLASSIC_CSV_FILES, generateTreeCsvFiles } from "../src/csv.js";
import { InMemoryReportDataWriter } from "../src/writer.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("csv");
  await label("coverage", "report-output");
});

const tr = (
  id: string,
  status: ReportTestResult["status"],
  labels: [string, string][],
  extra: Partial<ReportTestResult> = {},
): ReportTestResult =>
  ({
    id,
    name: `test ${id}`,
    status,
    start: 1700000000000,
    stop: 1700000001500,
    duration: 1500,
    labels: labels.map(([name, value]) => ({ name, value })),
    isRetry: false,
    ...extra,
  }) as unknown as ReportTestResult;

const generate = async (tests: ReportTestResult[]) => {
  const writer = new InMemoryReportDataWriter();

  await generateTreeCsvFiles(writer, tests);

  return Object.fromEntries(
    writer.reportFiles().map(({ name, value }) => [name, Buffer.from(value, "base64").toString("utf-8")]),
  );
};

describe("generateTreeCsvFiles", () => {
  it("writes a csv file for every classic tree page", async () => {
    const files = await generate([tr("1", "passed", [])]);

    expect(Object.keys(files).sort()).toEqual(
      Object.values(CLASSIC_CSV_FILES)
        .map((name) => `data/${name}`)
        .sort(),
    );
  });

  it("writes Allure 2 suites columns with one row per visible test", async () => {
    const files = await generate([
      tr(
        "1",
        "failed",
        [
          ["parentSuite", "Parent"],
          ["suite", "Suite"],
          ["subSuite", "Sub"],
          ["testClass", "my.Class"],
          ["testMethod", "method"],
        ],
        { description: 'with "quotes"' },
      ),
      tr("retry", "passed", [["suite", "Suite"]], { isRetry: true }),
    ]);
    const [header, ...rows] = files["data/suites.csv"].split("\n");

    expect(header).toBe(
      "Status,Start Time,Stop Time,Duration in ms,Parent Suite,Suite,Sub Suite,Test Class,Test Method,Name,Description",
    );
    expect(rows).toEqual([
      '"failed","2023-11-14T22:13:20.000Z","2023-11-14T22:13:21.500Z","1500","Parent","Suite","Sub","my.Class","method","test 1","with ""quotes"""',
    ]);
  });

  it("writes the plain text of the rendered description", async () => {
    const files = await generate([
      tr("1", "passed", [["suite", "Suite"]], {
        descriptionHtml: "<p><strong>Signed in</strong> as &lt;admin&gt; &amp; user</p>",
      }),
    ]);
    const [, row] = files["data/suites.csv"].split("\n");

    expect(row.endsWith('"Signed in as <admin> & user"')).toBe(true);
  });

  it("writes package column for packages csv", async () => {
    const files = await generate([tr("1", "passed", [["package", "a.b.c"]])]);
    const [header, row] = files["data/packages.csv"].split("\n");

    expect(header).toBe("Status,Start Time,Stop Time,Duration in ms,Package,Test Class,Test Method,Name,Description");
    expect(row).toContain('"a.b.c"');
  });

  it("aggregates status counts per epic, feature and story for behaviors csv", async () => {
    const files = await generate([
      tr("1", "passed", [
        ["epic", "E"],
        ["feature", "F"],
        ["story", "S"],
      ]),
      tr("2", "failed", [
        ["epic", "E"],
        ["feature", "F"],
        ["story", "S"],
      ]),
      tr("3", "broken", [["feature", "Other"]]),
    ]);

    expect(files["data/behaviors.csv"].split("\n")).toEqual([
      "Epic,Feature,Story,FAILED,BROKEN,PASSED,SKIPPED,UNKNOWN",
      '"E","F","S","1","0","1","0","0"',
      ',"Other",,"0","1","0","0","0"',
    ]);
  });

  it("aggregates status counts per category for categories csv", async () => {
    const files = await generate([
      tr("1", "failed", [], { categories: [{ name: "Product defects" }] }),
      tr("2", "failed", [], { categories: [{ name: "Product defects" }] }),
      tr("3", "broken", [], { categories: [{ name: "Test defects" }] }),
      tr("4", "passed", []),
    ]);

    expect(files["data/categories.csv"].split("\n")).toEqual([
      "Category,FAILED,BROKEN,PASSED,SKIPPED,UNKNOWN",
      '"Product defects","2","0","0","0","0"',
      '"Test defects","0","1","0","0","0"',
    ]);
  });
});
