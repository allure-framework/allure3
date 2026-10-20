import {
  type TestLabel,
  type TestResult,
  createDictionary,
  redactParameters,
  shouldHideLabel,
} from "@allurereport/core-api";
import { type ReportTestResult, convertTestStepResult } from "@allurereport/plugin-api";
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
  }, createDictionary<string[]>());
};

export const convertTestResult = (
  tr: TestResult,
  options: {
    hideLabels?: readonly (string | RegExp)[];
  } = {},
): ReportTestResult => {
  const labels = tr.labels.filter(({ name }) => !shouldHideLabel(name, options.hideLabels));

  return {
    id: tr.id,
    name: tr.name,
    start: tr.start,
    stop: tr.stop,
    duration: tr.duration,
    status: tr.status,
    fullName: tr.fullName,
    retryHash: tr.retryHash,
    testCaseHash: tr.testCaseHash,
    parametersHash: tr.parametersHash,
    environmentHash: tr.environmentHash,
    flaky: tr.flaky,
    muted: tr.muted,
    known: tr.known,
    resolution: tr.resolution,
    resolutionComment: tr.resolutionComment,
    isRetry: tr.isRetry,
    labels,
    groupedLabels: mapLabelsByName(labels),
    parameters: redactParameters(tr.parameters),
    links: tr.links,
    steps: (tr.steps ?? []).map(convertTestStepResult),
    error: tr.error,
    errors: tr.errors,
    testCase: tr.testCase,
    descriptionHtml: tr.descriptionHtml ?? markdownToHtml(tr.description),
    environment: tr.environment,
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    transition: tr.transition,
    titlePath: tr.titlePath || [],
  };
};
