import type { Statistic, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";

// duplicated the code from core to avoid circular dependency
export const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
      if (filter && !filter(test)) {
        return acc;
      }

      if (!acc[test.status]) {
        acc[test.status] = 0;
      }

      acc[test.status]!++;

      return acc;
    },
    { total: trsToProcess.length } as Statistic,
  );
};

const mockAttachment = {
  name: "sample.txt",
  source: "sample.txt",
  type: "text/plain",
  asBuffer: async () => Buffer.from("test content", "utf-8"),
  writeTo: async () => {},
};

const testResults: TestResult[] = [
  {
    id: "passed-test",
    name: "Passed test",
    status: "passed",
    start: 0,
    stop: 0,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    attachments: [{ name: "sample.txt", source: "sample.txt", type: "text/plain" }],
    steps: [],
    retries: [],
    history: [],
    retry: false,
    flaky: false,
    fullName: "Passed test",
    description: "",
    descriptionHtml: "",
    statusDetails: {},
    testCaseId: "passed-test",
    historyId: "passed-test",
  },
  {
    id: "failed-test",
    name: "Failed test",
    status: "failed",
    start: 0,
    stop: 0,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    attachments: [],
    steps: [],
    retries: [],
    history: [],
    retry: false,
    flaky: false,
    fullName: "Failed test",
    description: "",
    descriptionHtml: "",
    statusDetails: {},
    testCaseId: "failed-test",
    historyId: "failed-test",
  },
  {
    id: "broken-test",
    name: "Broken test",
    status: "broken",
    start: 0,
    stop: 0,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    attachments: [],
    steps: [],
    retries: [],
    history: [],
    retry: false,
    flaky: false,
    fullName: "Broken test",
    description: "",
    descriptionHtml: "",
    statusDetails: {},
    testCaseId: "broken-test",
    historyId: "broken-test",
  },
  {
    id: "skipped-test",
    name: "Skipped test",
    status: "skipped",
    start: 0,
    stop: 0,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    attachments: [],
    steps: [],
    retries: [],
    history: [],
    retry: false,
    flaky: false,
    fullName: "Skipped test",
    description: "",
    descriptionHtml: "",
    statusDetails: {},
    testCaseId: "skipped-test",
    historyId: "skipped-test",
  },
  {
    id: "unknown-test",
    name: "Unknown test",
    status: "unknown",
    start: 0,
    stop: 0,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    attachments: [],
    steps: [],
    retries: [],
    history: [],
    retry: false,
    flaky: false,
    fullName: "Unknown test",
    description: "",
    descriptionHtml: "",
    statusDetails: {},
    testCaseId: "unknown-test",
    historyId: "unknown-test",
  },
];

const store: AllureStore = {
  allTestResults: async () => testResults,
  fixturesByTrId: async () => [],
  historyByTrId: async () => [],
  retriesByTrId: async () => [],
  attachmentsByTrId: async () => [],
  allTestEnvGroups: async () => [],
  allEnvironments: async () => [],
  allVariables: async () => [],
  envVariables: async () => [],
  metadataByKey: async () => [],
  allAttachments: async () => [mockAttachment],
  attachmentContentById: async () => mockAttachment,
  testsStatistic: async () => ({
    total: testResults.length,
    passed: testResults.filter((tr) => tr.status === "passed").length,
    failed: testResults.filter((tr) => tr.status === "failed").length,
    broken: testResults.filter((tr) => tr.status === "broken").length,
    skipped: testResults.filter((tr) => tr.status === "skipped").length,
    unknown: testResults.filter((tr) => tr.status === "unknown").length,
  }),
  allHistoryDataPoints: async () => [],
};

const context: PluginContext = {
  reportFiles: {
    addFile: async () => {},
  },
};

export const fixtures = {
  store,
  context,
};

export function createFilesCollectorWithCheck(check: (path: string, content?: Buffer) => void) {
  const files: string[] = [];
  const context = {
    reportFiles: {
      addFile: async (filePath: string | { path: string }, content?: Buffer) => {
        const normalizedPath = typeof filePath === 'string' ? filePath : filePath.path;
        files.push(normalizedPath);
        check(normalizedPath, content);
      }
    }
  };
  return { files, context };
} 