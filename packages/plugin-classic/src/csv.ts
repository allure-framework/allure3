import type { TestStatus } from "@allurereport/core-api";
import type { ReportTestResult } from "@allurereport/plugin-api";
import { type CsvField, generateCsv, labelValue } from "@allurereport/plugin-csv";

import type { ClassicDataWriter } from "./writer.js";

/**
 * Names of the CSV files written to the `data` directory, one per tree page
 * (the same set of files Allure 2 provides for its "Download CSV" buttons)
 */
export const CLASSIC_CSV_FILES = {
  suites: "suites.csv",
  behaviors: "behaviors.csv",
  packages: "packages.csv",
  categories: "categories.csv",
} as const;

const formatTime = (timestamp?: number) =>
  typeof timestamp === "number" && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;

const formatNumber = (value?: number) => (typeof value === "number" ? String(value) : undefined);

// converted test results keep only the rendered description, so the CSV gets its plain text back
const htmlToText = (html?: string) => {
  const text = html
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return text || undefined;
};

const statusColumns: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];

const commonTestFields: CsvField<ReportTestResult>[] = [
  { header: "Status", accessor: "status" },
  { header: "Start Time", accessor: (tr) => formatTime(tr.start) },
  { header: "Stop Time", accessor: (tr) => formatTime(tr.stop) },
  { header: "Duration in ms", accessor: (tr) => formatNumber(tr.duration) },
];

const testTailFields: CsvField<ReportTestResult>[] = [
  { header: "Test Class", accessor: labelValue("testClass") },
  { header: "Test Method", accessor: labelValue("testMethod") },
  { header: "Name", accessor: "name" },
  { header: "Description", accessor: (tr) => tr.description ?? htmlToText(tr.descriptionHtml) },
];

/**
 * Allure 2 `suites.csv` columns: one row per test result
 */
export const suitesCsvFields: CsvField<ReportTestResult>[] = [
  ...commonTestFields,
  { header: "Parent Suite", accessor: labelValue("parentSuite") },
  { header: "Suite", accessor: labelValue("suite") },
  { header: "Sub Suite", accessor: labelValue("subSuite") },
  ...testTailFields,
];

/**
 * Same layout as `suites.csv`, but grouped by the package label
 */
export const packagesCsvFields: CsvField<ReportTestResult>[] = [
  ...commonTestFields,
  { header: "Package", accessor: labelValue("package") },
  ...testTailFields,
];

type StatusCountsRow = { key: string[]; counts: Record<TestStatus, number> };

const statusCountFields = (headers: string[]): CsvField<StatusCountsRow>[] => [
  ...headers.map((header, idx) => ({ header, accessor: (row: StatusCountsRow) => row.key[idx] || undefined })),
  ...statusColumns.map((status) => ({
    header: status.toUpperCase(),
    accessor: (row: StatusCountsRow) => String(row.counts[status] ?? 0),
  })),
];

const labelValues = (tr: ReportTestResult, name: string) => {
  const values = (tr.labels ?? [])
    .filter((label) => label.name === name && label.value)
    .map((label) => label.value as string);

  return values.length ? Array.from(new Set(values)) : [""];
};

const countByKeys = (tests: ReportTestResult[], keysOf: (tr: ReportTestResult) => string[][]) => {
  const rows = new Map<string, StatusCountsRow>();

  for (const tr of tests) {
    for (const key of keysOf(tr)) {
      const id = JSON.stringify(key);
      const row = rows.get(id) ?? {
        key,
        counts: { failed: 0, broken: 0, passed: 0, skipped: 0, unknown: 0 },
      };

      row.counts[tr.status] = (row.counts[tr.status] ?? 0) + 1;
      rows.set(id, row);
    }
  }

  return Array.from(rows.values());
};

/**
 * Allure 2 `behaviors.csv`: per epic/feature/story combination with status counts
 */
export const behaviorsCsvRows = (tests: ReportTestResult[]) =>
  countByKeys(tests, (tr) =>
    labelValues(tr, "epic").flatMap((epic) =>
      labelValues(tr, "feature").flatMap((feature) => labelValues(tr, "story").map((story) => [epic, feature, story])),
    ),
  );

/**
 * Allure 2 `categories.csv`: per category with status counts
 */
export const categoriesCsvRows = (tests: ReportTestResult[]) =>
  countByKeys(tests, (tr) => (tr.categories ?? []).map(({ name }) => [name]));

// rows are sorted by their key columns, the rows with an empty column go last
const byKey = (a: StatusCountsRow, b: StatusCountsRow) => {
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const left = a.key[i] ?? "";
    const right = b.key[i] ?? "";

    if (left === right) {
      continue;
    }

    if (!left || !right) {
      return left ? -1 : 1;
    }

    return left.localeCompare(right);
  }

  return 0;
};

export const generateTreeCsvFiles = async (writer: ClassicDataWriter, tests: ReportTestResult[]) => {
  const visibleTests = tests.filter((test) => !test.isRetry);

  await writer.writeRawData(CLASSIC_CSV_FILES.suites, await generateCsv(visibleTests, suitesCsvFields));
  await writer.writeRawData(CLASSIC_CSV_FILES.packages, await generateCsv(visibleTests, packagesCsvFields));
  await writer.writeRawData(
    CLASSIC_CSV_FILES.behaviors,
    await generateCsv(behaviorsCsvRows(visibleTests), statusCountFields(["Epic", "Feature", "Story"]), byKey),
  );
  await writer.writeRawData(
    CLASSIC_CSV_FILES.categories,
    await generateCsv(categoriesCsvRows(visibleTests), statusCountFields(["Category"]), byKey),
  );
};
