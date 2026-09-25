import { randomUUID } from "node:crypto";

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
import { findByLabelName, notNull } from "@allurereport/core-api";
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
import { extension, lookupContentType } from "@allurereport/reader-api";

const defaultStatus: TestStatus = "unknown";

// eslint-disable-next-line no-underscore-dangle
export const __unknown = "#___unknown_value___#";

export type StateData = {
  testCases: Map<string, TestCase>;
  attachments: Map<string, AttachmentLink>;
  visitAttachmentLink: (link: AttachmentLink) => void;
  /**
   * Returns a shared instance equal to the given string. Step names and parameters repeat across
   * results, and each JSON.parse call yields its own copies, so sharing them saves heap.
   */
  deduplicateString?: DeduplicateString;
};

type DeduplicateString = <T>(value: T) => T;

const noDeduplication: DeduplicateString = (value) => value;

export const testFixtureResultRawToState = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink" | "deduplicateString">,
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
    error: {
      message: raw.message,
      trace: raw.trace,
      ...(raw.actual && raw.expected ? { expected: raw.expected, actual: raw.actual } : {}),
    },

    ...processTimings(raw),

    steps: convertSteps(stateData, raw.steps).convertedSteps,
    sourceMetadata: {
      readerId: context.readerId,
      metadata: context.metadata ?? {},
    },
  };
};

export const testResultRawToState = (stateData: StateData, raw: RawTestResult, context: ReaderContext): TestResult => {
  const labels = convertLabels(raw.labels, stateData.deduplicateString);
  const hostId = findByLabelName(labels, "host");
  const threadId = findByLabelName(labels, "thread");
  const name = raw.name || "Unknown test";
  const testCase = processTestCase(stateData, raw);
  const parameters = convertParameters(raw.parameters, stateData.deduplicateString);

  return {
    id: md5(raw.uuid || randomUUID()),
    name,

    testCase,

    fullName: raw.fullName,
    historyId: calculateHistoryId(testCase, parameters),

    status: raw.status ?? defaultStatus,
    error: {
      message: raw.message,
      trace: raw.trace,
      ...(raw.actual && raw.expected ? { expected: raw.expected, actual: raw.actual } : {}),
    },

    ...processTimings(raw),

    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    precondition: raw.precondition,
    preconditionHtml: raw.preconditionHtml,
    expectedResult: raw.expectedResult,
    expectedResultHtml: raw.expectedResultHtml,

    flaky: raw.flaky ?? false,
    muted: raw.muted ?? false,
    known: raw.known ?? false,
    isRetry: false,

    labels,
    steps: convertSteps(stateData, raw.steps).convertedSteps,
    parameters,
    links: convertLinks(raw.links),

    hostId,
    threadId,

    sourceMetadata: {
      readerId: context.readerId,
      metadata: context.metadata ?? {},
    },
    titlePath: raw.titlePath ?? [],
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
      externalId: raw.testId,
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
    const contentType: string | undefined = attach.contentType ?? lookupContentType(attach.originalFileName);
    const ext = extension(attach.originalFileName, contentType) ?? "";
    const linkExpected: AttachmentLinkExpected = {
      id,
      originalFileName: attach.originalFileName,
      ext,
      name: attach.name ?? attach.originalFileName,
      contentType,
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
    // if no extension is specified for originalFileName, we should use provided
    // contentType in the link first, and only then rely on detected content type.
    ext: extension(previous.originalFileName, attach.contentType) ?? previous.ext ?? "",
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

const convertLabels = (
  labels: RawTestLabel[] | undefined,
  deduplicateString: DeduplicateString = noDeduplication,
): TestLabel[] => {
  return (
    labels
      ?.filter(notNull)
      ?.map((label) => convertLabel(label, deduplicateString))
      ?.flatMap(processTagLabels) ?? []
  );
};

const convertLabel = (label: RawTestLabel, deduplicateString: DeduplicateString): TestLabel => {
  return {
    name: deduplicateString(label.name ?? __unknown),
    value: deduplicateString(label.value),
  };
};

const convertSteps = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink" | "deduplicateString">,
  steps: RawStep[] | undefined,
): { convertedSteps: TestStepResult[]; messages: Set<string> } => {
  const convertedStepData = steps?.filter(notNull)?.map((step) => convertStep(stateData, step)) ?? [];
  return {
    convertedSteps: convertedStepData.map(({ convertedStep }) => convertedStep),
    messages: new Set(
      convertedStepData.reduce((acc, { messages }) => {
        if (messages) {
          acc.push(...messages);
        }
        return acc;
      }, [] as string[]),
    ),
  };
};

const convertStep = (
  stateData: Pick<StateData, "attachments" | "visitAttachmentLink" | "deduplicateString">,
  step: RawStep,
): { convertedStep: TestStepResult; messages?: Set<string> } => {
  if (step.type === "step") {
    const deduplicateString = stateData.deduplicateString ?? noDeduplication;
    const { message } = step;
    const { convertedSteps: subSteps, messages } = convertSteps(stateData, step.steps);
    const hasSimilarErrorInSubSteps = !!message && messages.has(message);
    if (message && !hasSimilarErrorInSubSteps) {
      messages.add(message);
    }

    return {
      convertedStep: {
        stepId: md5(`${step.name}${step.start}`),
        name: deduplicateString(step.name ?? __unknown),
        status: step.status ?? defaultStatus,
        steps: subSteps,
        parameters: convertParameters(step.parameters, deduplicateString),
        ...processTimings(step),
        type: "step",
        message: deduplicateString(message),
        trace: deduplicateString(step.trace),
        hasSimilarErrorInSubSteps,
      },
      messages,
    };
  }
  return {
    convertedStep: {
      ...processAttachmentLink(stateData, step),
    },
  };
};

const convertParameters = (
  parameters: RawTestParameter[] | undefined,
  deduplicateString: DeduplicateString = noDeduplication,
): TestParameter[] =>
  parameters
    ?.filter(notNull)
    ?.filter((p) => p.name)
    ?.map((param) => convertParameter(param, deduplicateString)) ?? [];

const convertParameter = (param: RawTestParameter, deduplicateString: DeduplicateString): TestParameter => ({
  name: deduplicateString(param.name ?? __unknown),
  value: deduplicateString(param.value ?? __unknown),
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

const calculateTestId = (raw: RawTestResult): [string | undefined, string | undefined] => {
  const maybeAllureId = raw.labels?.find(
    (label) => (label.name === "ALLURE_ID" || label.name === "AS_ID") && label.value !== "-1",
  )?.value;
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
