import {
  type TestLabel,
  type TestLink,
  type TestResult,
  createDictionary,
  getMutedResolutionState,
  redactParameters,
  shouldHideLabel,
} from "@allurereport/core-api";
import type { ReportTestResult } from "@allurereport/plugin-api";
import { convertTestStepResult } from "@allurereport/plugin-api/internal/report";
import MarkdownIt from "markdown-it";

import type { IdeaLinksOptions } from "./model.js";

const md = new MarkdownIt();
const markdownToHtml = (value?: string): string | undefined => (value ? md.render(value) : undefined);

// dot-separated identifiers only, so that suite names and other non-class values do not produce broken links
const javaClassNameRegexp = /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u;

const createIdeaLink = (labels: TestLabel[], options: boolean | IdeaLinksOptions): TestLink[] => {
  const { port = 63342, fileExtension = "java", sourceRoot = "" } = options === true ? {} : options || {};
  const testClass = labels.find(({ name, value }) => name === "testClass" && value)?.value;
  // nested classes (`Outer$Inner`) live in the file of the outer class
  const classPath = testClass?.split("$")[0].replaceAll(".", "/");

  if (!testClass || !classPath || !javaClassNameRegexp.test(testClass)) {
    return [];
  }

  const root = sourceRoot.replace(/^\/+|\/+$/g, "");
  const file = `${root ? `${root}/` : ""}${classPath}.${fileExtension.replace(/^\./, "")}`;

  return [
    { name: "Open in IDEA", type: "idea", url: `http://localhost:${port}/api/file?file=${encodeURIComponent(file)}` },
  ];
};

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
    ideaLinks?: boolean | IdeaLinksOptions;
    resolutionEvaluatedAt?: number;
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
    resolutionExpiresAt: tr.resolutionExpiresAt,
    resolutionState: getMutedResolutionState(tr, options.resolutionEvaluatedAt),
    isRetry: tr.isRetry,
    labels,
    groupedLabels: mapLabelsByName(labels),
    parameters: redactParameters(tr.parameters),
    links: options.ideaLinks ? [...tr.links, ...createIdeaLink(tr.labels, options.ideaLinks)] : tr.links,
    steps: (tr.steps ?? []).map(convertTestStepResult),
    error: tr.error,
    errors: tr.errors,
    testCase: tr.testCase,
    descriptionHtml: tr.descriptionHtml ?? markdownToHtml(tr.description),
    preconditionHtml: tr.preconditionHtml ?? markdownToHtml(tr.precondition),
    expectedResultHtml: tr.expectedResultHtml ?? markdownToHtml(tr.expectedResult),
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
