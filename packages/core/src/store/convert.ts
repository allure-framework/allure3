import type {
  AttachmentLink,
  AttachmentLinkExpected,
  AttachmentLinkInvalid,
  AttachmentLinkLinked,
  AttachmentTestStepResult,
  TestCase,
  TestFixtureResult,
  TestLabel,
  TestLink,
  TestParameter,
  TestResult,
  TestStatus,
  TestStepResult,
} from "@allurereport/core-api";
import { notNull } from "@allurereport/core-api";
import { findByLabelName } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type {
  RawFixtureResult,
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  ReaderContext,
} from "@allurereport/reader-api";
import MarkdownIt from "markdown-it";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

const defaultStatus: TestStatus = "unknown";

// eslint-disable-next-line no-underscore-dangle
export const __unknown = "#___unknown_value___#";

export type StateData = {
  testCases: Map<string, TestCase>;
  attachments: Map<string, AttachmentLink>;
  visitAttachmentLink: (link: AttachmentLink) => void;
};

export const testFixtureResultRawToState = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink">,
  raw: RawFixtureResult,
  context: ReaderContext,
): TestFixtureResult => {
  const name = raw.name || "Unknown test";
  return {
    id: md5(raw.uuid || randomUUID()),
    testResultIds: raw.testResults?.filter(notNull).map(md5) ?? [],
    type: raw.type,
    name,
    status: raw.status ?? defaultStatus,
    message: raw.message,
    trace: raw.trace,

    ...processTimings(raw),

    steps: convertSteps(stateData, raw.steps),
    sourceMetadata: {
      readerId: context.readerId,
      metadata: context.metadata ?? {},
    },
  };
};

export const testResultRawToState = (stateData: StateData, raw: RawTestResult, context: ReaderContext): TestResult => {
  const labels = convertLabels(raw.labels);

  const hostId = findByLabelName(labels, "host");
  const threadId = findByLabelName(labels, "thread");

  const name = raw.name || "Unknown test";

  const testCase = processTestCase(stateData, raw);

  const parameters = convertParameters(raw.parameters);

  return {
    id: md5(raw.uuid || randomUUID()),
    name,

    testCase,

    fullName: raw.fullName,
    historyId: calculateHistoryId(testCase, parameters),

    status: raw.status ?? defaultStatus,
    message: raw.message,
    trace: raw.trace,

    ...processTimings(raw),

    description: raw.description,
    descriptionHtml: raw.descriptionHtml ?? markdownToHtml(raw.description),
    precondition: raw.precondition,
    preconditionHtml: raw.preconditionHtml ?? markdownToHtml(raw.precondition),
    expectedResult: raw.expectedResult,
    expectedResultHtml: raw.expectedResultHtml ?? markdownToHtml(raw.expectedResult),

    flaky: raw.flaky ?? false,
    muted: raw.muted ?? false,
    known: raw.known ?? false,
    hidden: false,

    labels,
    steps: convertSteps(stateData, raw.steps),
    parameters,
    links: convertLinks(raw.links),

    hostId,
    threadId,

    sourceMetadata: {
      readerId: context.readerId,
      metadata: context.metadata ?? {},
    },
  };
};

const processTestCase = ({ testCases }: StateData, raw: RawTestResult): TestCase | undefined => {
  const [id, allureId] = calculateTestId(raw);
  if (id) {
    const maybeTestCase = testCases.get(id);
    if (maybeTestCase) {
      return maybeTestCase;
    }

    const testCase: TestCase = {
      id,
      allureId,
      name: raw.testCaseName ?? raw.name ?? __unknown,
      fullName: raw.fullName,
    };
    testCases.set(id, testCase);
    return testCase;
  }

  return undefined;
};

const createAttachmentStep = (
  link: AttachmentLinkExpected | AttachmentLinkLinked | AttachmentLinkInvalid,
): AttachmentTestStepResult => {
  return {
    link,
    type: "attachment",
  };
};

const processAttachmentLink = (
  { attachments, visitAttachmentLink }: Pick<StateData, "attachments" | "visitAttachmentLink">,
  attach: RawTestAttachment,
): AttachmentTestStepResult => {
  if (!attach.originalFileName) {
    return createAttachmentStep({
      id: randomUUID(),
      originalFileName: undefined,
      contentType: attach.contentType,
      ext: "",
      name: attach.name ?? __unknown,
      missed: true,
      used: true,
    });
  }

  const id = md5(attach.originalFileName);

  const previous: AttachmentLink | undefined = attachments.get(id);

  if (!previous) {
    const linkExpected: AttachmentLinkExpected = {
      id,
      originalFileName: attach.originalFileName,
      ext: extname(attach.originalFileName),
      name: attach.name ?? attach.originalFileName,
      contentType: attach.contentType,
      used: true,
      missed: true,
    };
    attachments.set(id, linkExpected);
    visitAttachmentLink(linkExpected);
    return createAttachmentStep(linkExpected);
  }

  // deny reusing same file multiple times
  if (previous.used) {
    return createAttachmentStep({
      // random id to prevent collisions
      id: randomUUID(),
      originalFileName: undefined,
      ext: "",
      name: attach.name ?? attach.originalFileName ?? __unknown,
      contentType: attach.contentType,
      missed: true,
      used: true,
    });
  }

  const link: AttachmentLinkLinked = {
    ...previous,
    id,
    name: attach.name ?? previous.originalFileName,
    contentType: attach.contentType ?? previous.contentType,
    contentLength: previous.contentLength,
    used: true,
    missed: false,
  };
  attachments.set(id, link);
  visitAttachmentLink(link);
  return createAttachmentStep(link);
};

const processTimings = ({
  start,
  stop,
  duration,
}: {
  start?: number;
  stop?: number;
  duration?: number;
}): { start?: number; stop?: number; duration?: number } => {
  const effectiveDuration = duration ? Math.max(0, duration) : 0;

  if (start !== undefined) {
    if (stop !== undefined) {
      if (stop < start) {
        return { start, stop: start, duration: 0 };
      }
      return { start, stop, duration: stop - start };
    }
    return { start, stop: start + effectiveDuration, duration: effectiveDuration };
  }

  if (stop !== undefined) {
    return { start: stop - effectiveDuration, stop, duration: effectiveDuration };
  }

  // sometimes there is no start/stop info available, but only duration (e.g. junit.xml)
  return { start: undefined, stop: undefined, duration };
};

const convertLabels = (labels: RawTestLabel[] | undefined): TestLabel[] => {
  return labels?.filter(notNull)?.map(convertLabel)?.flatMap(processTagLabels) ?? [];
};

const convertLabel = (label: RawTestLabel): TestLabel => {
  return {
    name: label.name ?? __unknown,
    value: label.value,
  };
};

const convertSteps = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink">,
  steps: RawStep[] | undefined,
): TestStepResult[] => steps?.filter(notNull)?.map((step) => convertStep(stateData, step)) ?? [];

const convertStep = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink">,
  step: RawStep,
): TestStepResult => {
  if (step.type === "step") {
    return {
      name: step.name ?? __unknown,
      status: step.status ?? defaultStatus,
      steps: convertSteps(stateData, step.steps),
      parameters: convertParameters(step.parameters),
      ...processTimings(step),
      type: "step",
    };
  }
  return {
    ...processAttachmentLink(stateData, step),
  };
};

const convertParameters = (parameters: RawTestParameter[] | undefined): TestParameter[] =>
  parameters
    ?.filter(notNull)
    ?.filter((p) => p.name)
    ?.map(convertParameter) ?? [];

const convertParameter = (param: RawTestParameter): TestParameter => ({
  name: param.name ?? __unknown,
  value: param.value ?? __unknown,
  hidden: param.hidden ?? false,
  excluded: param.excluded ?? false,
  masked: param.masked ?? false,
});

const convertLinks = (links: RawTestLink[] | undefined): TestLink[] =>
  links
    ?.filter(notNull)
    ?.filter((l) => l.url)
    ?.map(convertLink) ?? [];

const convertLink = (link: RawTestLink): TestLink => ({
  name: link.name,
  url: link.url ?? __unknown,
  type: link.type,
});

const markdownToHtml = (value?: string): string | undefined => (value ? new MarkdownIt().render(value) : undefined);

const calculateTestId = (raw: RawTestResult): [string | undefined, string | undefined] => {
  const maybeAllureId = raw.labels?.find((label) => label.name === "ALLURE_ID" || label.name === "AS_ID")?.value;
  if (maybeAllureId) {
    return [md5(`ALLURE_ID=${maybeAllureId}`), maybeAllureId];
  }
  if (raw.testId) {
    return [md5(raw.testId), undefined];
  }
  if (raw.fullName) {
    return [md5(raw.fullName), undefined];
  }
  return [undefined, undefined];
};

const calculateHistoryId = (testCase: TestCase | undefined, parameters: TestParameter[]): string | undefined => {
  if (!testCase) {
    return undefined;
  }
  const paramsPart = stringifyParams(parameters);
  return `${testCase.id}.${md5(paramsPart)}`;
};

const parametersCompare = (a: TestParameter, b: TestParameter) => {
  return (a.name ?? "").localeCompare(b.name) || a.value.localeCompare(b.value ?? "");
};

const stringifyParams = (parameters: TestParameter[] | undefined): string => {
  if (!parameters) {
    return "";
  }

  return parameters
    .filter((p) => !p?.excluded)
    .sort(parametersCompare)
    .map((p) => `${p.name}:${p.value}`)
    .join(",");
};

const idLabelMatcher = new RegExp("^@?allure\\.id[:=](?<id>.+)$");
const tagLabelMatcher = new RegExp("^@?allure\\.label\\.(?<name>.+)[:=](?<value>.+)$");

const processTagLabels = (label: TestLabel): TestLabel[] => {
  if (label.name === "tag" && label.value) {
    const matchTag = label.value.match(idLabelMatcher);
    if (matchTag) {
      const id = matchTag?.groups?.id;
      return id ? [{ name: "ALLURE_ID", value: id }] : [];
    }
    const matchLabel = label.value.match(tagLabelMatcher);
    if (matchLabel) {
      const name = matchLabel?.groups?.name;
      const value = matchLabel?.groups?.value;
      return name && value ? [{ name, value }] : [];
    }
  }
  return label.name ? [{ name: label.name, value: label.value }] : [];
};
