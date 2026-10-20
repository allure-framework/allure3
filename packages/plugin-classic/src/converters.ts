import { type TestLabel, type TestResult, redactParameters } from "@allurereport/core-api";
import type { ReportTestResult } from "@allurereport/plugin-api";
import { convertTestStepResult } from "@allurereport/plugin-api/internal/report";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt();
const markdownToHtml = (value?: string): string | undefined => (value ? md.render(value) : undefined);

const mapLabelsByName = (labels: TestLabel[]): Record<string, string[]> => {
  return labels.reduce<Record<string, string[]>>((acc, { name, value }: TestLabel) => {
    acc[name] = acc[name] || [];

    if (value) {
      acc[name].push(value);
    }

    return acc;
  }, {});
};

export const convertTestResult = (tr: TestResult): ReportTestResult => {
  return {
    id: tr.id,
    name: tr.name,
    start: tr.start,
    stop: tr.stop,
    duration: tr.duration,
    status: tr.status,
    fullName: tr.fullName,
    testCaseHash: tr.testCaseHash,
    parametersHash: tr.parametersHash,
    environmentHash: tr.environmentHash,
    retryHash: tr.retryHash,
    flaky: tr.flaky,
    muted: tr.muted,
    known: tr.known,
    isRetry: tr.isRetry,
    labels: tr.labels,
    groupedLabels: mapLabelsByName(tr.labels),
    parameters: redactParameters(tr.parameters),
    links: tr.links,
    steps: (tr.steps ?? []).map(convertTestStepResult),
    error: tr.error,
    errors: tr.errors,
    testCase: tr.testCase,
    descriptionHtml: tr.descriptionHtml ?? markdownToHtml(tr.description),
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    transition: tr.transition,
  };
};
