import { type AllureStore, type TestResult, formatDuration } from "@allurereport/core-api";
import type { Plugin, PluginContext } from "@allurereport/plugin-api";
import { generateCsv } from "./csv.js";
import type { CsvField, CsvPluginOptions } from "./model.js";
import { formatSteps, labelValue } from "./utils.js";

const defaultFields: CsvField<TestResult>[] = [
  { header: "Full Name", accessor: "fullName" },
  {
    header: "Name",
    accessor: "name",
  },
  {
    header: "Status",
    accessor: "status",
  },
  {
    header: "Duration",
    accessor: (result) => formatDuration(result.duration),
  },
  { header: "Error", accessor: (tr) => tr.error?.message },
  { header: "Stack Trace", accessor: (tr) => tr.error?.trace },
  { header: "Steps", accessor: formatSteps },

  { header: "Parent Suite", accessor: labelValue("parentSuite") },
  { header: "Suite", accessor: labelValue("suite") },
  { header: "Sub Suite", accessor: labelValue("subSuite") },
  { header: "Epic", accessor: labelValue("epic") },
  { header: "Feature", accessor: labelValue("feature") },
  { header: "Story", accessor: labelValue("story") },
];

const defaultSort = (a: TestResult, b: TestResult): number => a.name.localeCompare(b.name);

export class CsvPlugin implements Plugin {
  constructor(readonly options: CsvPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const { reportFiles } = context;
    const testResults = await store.allTestResults();
    const { fields = defaultFields, sort = defaultSort, filter, fileName = "report.csv" } = this.options;
    const content = await generateCsv(testResults, fields, sort, filter, this.options);
    const result = Buffer.from(content, "utf-8");

    await reportFiles.addFile(fileName, result);
  };
}
