import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawStep,
  RawTestAttachment,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStepResult,
} from "@allurereport/reader-api";
import { randomUUID } from "node:crypto";
import type { ShallowKnown, Unknown } from "../../../validation.js";
import { ensureObject, isDefined, isObject } from "../../../validation.js";
import {
  DEFAULT_ATTACHMENT_NAME,
  DEFAULT_BUNDLE_NAME,
  DEFAULT_EXPECTED_FAILURE_REASON,
  DEFAULT_STEP_NAME,
  DEFAULT_SUITE_NAME,
  DEFAULT_TEST_NAME,
  applyApiCalls,
  createTestLabels,
  getTargetDetails,
  getWorstStatus,
  parseAsAllureApiActivity,
  secondsToMilliseconds,
  toSortedSteps,
} from "../../utils.js";
import type { ApiParseFunction, AttachmentFileFactory, ParsingContext } from "../model.js";
import { getById, getRoot } from "./cli.js";
import type {
  ActionParametersInputData,
  ActivityProcessingResult,
  FailureMap,
  FailureMapValue,
  FailureOverrides,
  LegacyActionDiscriminator,
  LegacyDestinationData,
  LegacyParsingState,
  ResolvedStepFailure,
} from "./model.js";
import {
  getBool,
  getDate,
  getDouble,
  getInt,
  getObjectArray,
  getString,
  getStringArray,
  getURL,
  getUnionType,
} from "./parsing.js";
import {
  convertTraceLine,
  withNewSuite as ensureSuiteNesting,
  resolveFailureStepStatus,
  resolveTestStatus,
} from "./utils.js";
import type {
  XcActionDeviceRecord,
  XcActionPlatformRecord,
  XcActionRecord,
  XcActionRunDestinationRecord,
  XcActionTestActivitySummary,
  XcActionTestAttachment,
  XcActionTestExpectedFailure,
  XcActionTestFailureSummary,
  XcActionTestMetadata,
  XcActionTestPlanRunSummaries,
  XcActionTestRepetitionPolicySummary,
  XcActionTestSummary,
  XcActionTestSummaryGroup,
  XcActionTestSummaryIdentifiableObject,
  XcArray,
  XcIssueTrackingMetadata,
  XcSourceCodeContext,
  XcString,
  XcTestArgument,
  XcTestParameter,
  XcTestTag,
  XcTestValue,
} from "./xcModel.js";
import { XcActionTestSummaryIdentifiableObjectTypes } from "./xcModel.js";

const IDENTIFIER_URL_PREFIX = "test://com.apple.xcode/";
const ACTIVITY_TYPE_ATTACHMENT = "com.apple.dt.xctest.activity-type.attachmentContainer";

const parse: ApiParseFunction = async function* (
  context: ParsingContext,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { xcResultPath } = context;
  const root = await getRoot(xcResultPath);
  if (isObject(root)) {
    const actions = getObjectArray(root.actions);
    const actionDescriminators = parseActionDiscriminators(actions);
    const multiTarget = isMultiTarget(actionDescriminators);
    const multiTestPlan = isMultiTestPlan(actionDescriminators);
    for (const { actionResult } of actions) {
      const { destination, testPlan } = actionDescriminators.shift()!;
      if (isObject(actionResult)) {
        const { testsRef } = actionResult;
        const summaries = await getById<XcActionTestPlanRunSummaries>(xcResultPath, testsRef);
        if (isObject(summaries)) {
          for (const { testableSummaries } of getObjectArray(summaries.summaries)) {
            for (const { name, tests } of getObjectArray(testableSummaries)) {
              const bundle = getString(name) ?? DEFAULT_BUNDLE_NAME;
              yield* traverseActionTestSummaries(context, tests, {
                bundle,
                suites: [],
                destination,
                testPlan,
                multiTarget,
                multiTestPlan,
              });
            }
          }
        }
      }
    }
  }
};

export default parse;

const parseActionDiscriminators = (actions: ShallowKnown<XcActionRecord>[]): LegacyActionDiscriminator[] => {
  return actions.map(({ runDestination, testPlanName }) => ({
    destination: parseDestination(runDestination),
    testPlan: getString(testPlanName),
  }));
};

const isMultiTarget = (discriminators: LegacyActionDiscriminator[]) =>
  new Set(
    discriminators
      .map(({ destination }) => destination)
      .filter(isDefined)
      .map(({ name }) => name)
      .filter(isDefined),
  ).size > 1;

const isMultiTestPlan = (discriminators: LegacyActionDiscriminator[]) =>
  new Set(
    discriminators
      .map(({ testPlan }) => testPlan)
      .filter(isDefined)
      .filter(isDefined),
  ).size > 1;

const parseDestination = (element: Unknown<XcActionRunDestinationRecord>): LegacyDestinationData | undefined => {
  if (isObject(element)) {
    const { displayName, targetArchitecture, targetDeviceRecord, localComputerRecord } = element;
    const targetName = getString(displayName);
    const hostName = parseHostName(localComputerRecord);
    const architecture = getString(targetArchitecture);
    const { model, platform, osVersion } = parseTargetDevice(targetDeviceRecord) ?? {};

    return {
      name: targetName,
      hostName,
      targetDetails: getTargetDetails({ architecture, model, platform, osVersion }),
    };
  }
};

const parseHostName = (element: Unknown<XcActionDeviceRecord>) => {
  if (isObject(element)) {
    return getString(element.name);
  }
};

const parseTargetDevice = (element: Unknown<XcActionDeviceRecord>) => {
  if (isObject(element)) {
    const { modelName, operatingSystemVersion, platformRecord } = element;
    return {
      model: getString(modelName),
      platform: parsePlatform(platformRecord),
      osVersion: getString(operatingSystemVersion),
    };
  }
};

const parsePlatform = (element: Unknown<XcActionPlatformRecord>) => {
  if (isObject(element)) {
    return getString(element.userDescription);
  }
};

const traverseActionTestSummaries = async function* (
  context: ParsingContext,
  array: Unknown<XcArray<XcActionTestSummaryIdentifiableObject>>,
  state: LegacyParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  for (const obj of getObjectArray(array)) {
    switch (getUnionType(obj, XcActionTestSummaryIdentifiableObjectTypes)) {
      case "ActionTestMetadata":
        yield* visitActionTestMetadata(context, obj as ShallowKnown<XcActionTestMetadata>, state);
        break;
      case "ActionTestSummary":
        yield* visitActionTestSummary(context, obj as ShallowKnown<XcActionTestSummary>, state);
        break;
      case "ActionTestSummaryGroup":
        yield* visitActionTestSummaryGroup(context, obj as ShallowKnown<XcActionTestSummaryGroup>, state);
        break;
    }
  }
};

const visitActionTestMetadata = async function* (
  context: ParsingContext,
  { summaryRef }: ShallowKnown<XcActionTestMetadata>,
  state: LegacyParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { xcResultPath } = context;
  const summary = await getById<XcActionTestSummary>(xcResultPath, summaryRef);
  if (isObject(summary)) {
    yield* visitActionTestSummary(context, summary, state);
  }
};

const visitActionTestSummary = async function* (
  { createAttachmentFile }: ParsingContext,
  {
    arguments: args,
    duration,
    identifierURL,
    name: rawName,
    summary,
    activitySummaries,
    tags,
    trackedIssues,
    failureSummaries,
    expectedFailures,
    testStatus,
    repetitionPolicySummary,
  }: ShallowKnown<XcActionTestSummary>,
  state: LegacyParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { bundle, className, suites, destination: { hostName } = {} } = state;
  const fullName = getString(identifierURL) ?? randomUUID();
  const projectName = parseProjectName(fullName);
  const functionName = getString(rawName);
  const name = getString(summary) ?? functionName ?? DEFAULT_TEST_NAME;
  const status = getString(testStatus);
  const labels = createTestLabels({
    hostName,
    projectName,
    bundle,
    className,
    functionName,
    suites: suites.map(({ name: suite }) => suite),
    tags: parseTestTags(tags),
  });
  const parameters = getAllTestResultParameters(state, args, repetitionPolicySummary);
  const failures = await processFailures(createAttachmentFile, failureSummaries, expectedFailures);
  const {
    steps: activitySteps,
    files,
    apiCalls,
  } = await processActivities(createAttachmentFile, failures, getObjectArray(activitySummaries));
  const { message, trace, steps: failureSteps } = resolveTestFailures(failures);
  const steps = toSortedSteps(activitySteps, failureSteps);
  const testResult: RawTestResult = {
    uuid: randomUUID(),
    fullName,
    name,
    duration: secondsToMilliseconds(getDouble(duration)),
    labels,
    parameters,
    steps,
    links: parseTrackedIssues(trackedIssues),
    message,
    status: resolveTestStatus(status, steps),
    trace,
  };
  applyApiCalls(testResult, apiCalls);

  yield* files;
  yield* iterateFailureFiles(failures);
  yield testResult;
};

const iterateFailureFiles = function* (failures: FailureMap) {
  for (const { files } of failures.values()) {
    yield* files;
  }
};

const parseTrackedIssues = (issues: Unknown<XcArray<XcIssueTrackingMetadata>>): RawTestLink[] =>
  getObjectArray(issues)
    .map(({ comment, identifier, url: rawUrl }) => {
      const name = getString(comment);
      const url = getURL(rawUrl) ?? getString(identifier);
      return url ? { type: "issue", name, url } : undefined;
    })
    .filter(isDefined);

const processFailures = async (
  createAttachmentFile: AttachmentFileFactory,
  failures: Unknown<XcArray<XcActionTestFailureSummary>>,
  expectedFailures: Unknown<XcArray<XcActionTestExpectedFailure>>,
): Promise<FailureMap> => {
  const failureEntries = await parseFailureEntries(createAttachmentFile, failures);
  const expectedFailureEntries = await parseExpectedFailureEntries(createAttachmentFile, expectedFailures);
  return new Map([...failureEntries, ...expectedFailureEntries]);
};

const parseFailureEntries = async (
  createAttachmentFile: AttachmentFileFactory,
  failures: Unknown<XcArray<XcActionTestFailureSummary>>,
) => {
  const entries: [string, FailureMapValue][] = [];
  for (const summary of getObjectArray(failures)) {
    const entry = await toFailureMapEntry(createAttachmentFile, summary);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
};

const parseExpectedFailureEntries = async (
  createAttachmentFile: AttachmentFileFactory,
  expectedFailures: Unknown<XcArray<XcActionTestExpectedFailure>>,
) => {
  const entries: [string, FailureMapValue][] = [];
  for (const { uuid, failureReason, failureSummary } of getObjectArray(expectedFailures)) {
    if (isObject(failureSummary)) {
      const mapMessage = (message: string | undefined) => {
        const prefix = getString(failureReason) ?? DEFAULT_EXPECTED_FAILURE_REASON;
        return message ? `${prefix}:\n  ${message}` : prefix;
      };

      const entry = await toFailureMapEntry(createAttachmentFile, failureSummary, {
        uuid,
        status: "passed",
        mapMessage,
      });

      if (entry) {
        entries.push(entry);
      }
    }
  }
  return entries;
};

const toFailureMapEntry = async (
  createAttachmentFile: AttachmentFileFactory,
  {
    attachments,
    message: rawMessage,
    sourceCodeContext,
    timestamp,
    uuid: rawUuid,
    isTopLevelFailure,
    issueType,
  }: ShallowKnown<XcActionTestFailureSummary>,
  { uuid: explicitUuid, mapMessage, status: explicitStatus }: FailureOverrides = {},
) => {
  const { steps, files } = await parseAttachments(createAttachmentFile, getObjectArray(attachments));
  const message = getString(rawMessage);
  const status = explicitStatus ?? resolveFailureStepStatus(getString(issueType));
  const trace = convertStackTrace(sourceCodeContext);
  const start = getDate(timestamp);
  const uuid = getString(explicitUuid) ?? getString(rawUuid);
  return uuid
    ? ([
        uuid,
        {
          step: {
            type: "step",
            start,
            stop: start,
            duration: 0,
            message: mapMessage?.(message) ?? message,
            name: message,
            status,
            steps,
            trace,
          },
          files,
          isTopLevel: getBool(isTopLevelFailure),
        },
      ] as [string, FailureMapValue])
    : undefined;
};

const convertStackTrace = (sourceCodeContext: Unknown<XcSourceCodeContext>) => {
  if (isObject(sourceCodeContext)) {
    const { callStack } = sourceCodeContext;
    return getObjectArray(callStack)
      .map(({ symbolInfo }) => symbolInfo)
      .filter(isObject)
      .map(({ location, symbolName }) => {
        const { filePath, lineNumber } = ensureObject(location) ?? {};
        return convertTraceLine(getString(symbolName), getString(filePath), getInt(lineNumber));
      })
      .filter(isDefined)
      .join("\n");
  }
};

const processActivities = async (
  createAttachmentFile: AttachmentFileFactory,
  failures: FailureMap,
  activities: readonly ShallowKnown<XcActionTestActivitySummary>[],
): Promise<ActivityProcessingResult> => {
  const results: ActivityProcessingResult[] = [];
  for (const {
    activityType,
    title,
    start,
    finish,
    attachments: rawAttachments,
    subactivities: rawSubactivities,
    failureSummaryIDs,
  } of activities) {
    const attachments = getObjectArray(rawAttachments);
    const subactivities = getObjectArray(rawSubactivities);
    const failureIds = getStringArray(failureSummaryIDs);

    const parsedAttachments = await parseAttachments(createAttachmentFile, attachments);
    if (getString(activityType) === ACTIVITY_TYPE_ATTACHMENT) {
      return parsedAttachments;
    }

    const name = getString(title);

    if (attachments.length === 0 && subactivities.length === 0 && failureIds.length === 0) {
      const parsedAllureApiCall = parseAsAllureApiActivity(name);
      if (isDefined(parsedAllureApiCall)) {
        return {
          steps: [],
          files: [],
          apiCalls: [parsedAllureApiCall],
        };
      }
    }

    const { steps: thisStepAttachmentSteps, files: thisStepFiles } = parsedAttachments;
    const {
      steps: substeps,
      files: substepFiles,
      apiCalls,
    } = await processActivities(createAttachmentFile, failures, subactivities);

    const failureSteps = failureIds.map((uuid) => failures.get(uuid)).filter(isDefined);
    const { steps: nestedFailureSteps, message, trace } = resolveFailuresOfStep(failureIds, failureSteps);

    const steps = toSortedSteps(thisStepAttachmentSteps, substeps, nestedFailureSteps);

    const result = {
      steps: [
        {
          type: "step",
          name: name ?? DEFAULT_STEP_NAME,
          start: getDate(start),
          stop: getDate(finish),
          status: getWorstStatus(steps) ?? "passed",
          message,
          trace,
          steps,
        } as RawTestStepResult,
      ],
      files: [...thisStepFiles, ...substepFiles],
      apiCalls,
    };
    results.push(result);
  }
  return mergeActivityProcessingResults(...results);
};

const resolveFailuresOfStep = (failureUids: string[], failures: readonly FailureMapValue[]): ResolvedStepFailure =>
  resolveFailures(
    failureUids.length > failures.length
      ? [
          ...failures,
          ...new Array<FailureMapValue>(failureUids.length - failures.length).fill({
            files: [],
            step: {
              type: "step",
              duration: 0,
              message: "Un unknown failure has occured",
              status: "broken",
            },
          }),
        ]
      : failures,
  );

const resolveTestFailures = (failures: FailureMap): ResolvedStepFailure =>
  resolveFailures(Array.from(failures.values()).filter(({ isTopLevel }) => isTopLevel));

const resolveFailures = (failures: readonly FailureMapValue[]): ResolvedStepFailure => {
  switch (failures.length) {
    case 0:
      return { steps: [] };
    case 1:
      return prepareOneFailure(failures as [FailureMapValue]);
    default:
      return prepareMultipleFailures(failures as [FailureMapValue, ...FailureMapValue[]]);
  }
};

const prepareOneFailure = ([
  {
    step: { message, trace },
  },
]: readonly [FailureMapValue]): ResolvedStepFailure => ({
  message,
  trace,
  steps: [],
});

const prepareMultipleFailures = (failures: readonly [FailureMapValue, ...FailureMapValue[]]): ResolvedStepFailure => {
  const [
    {
      step: { message, trace },
    },
  ] = failures;
  const steps = failures.map(({ step }) => step);
  return {
    message: `${failures.length} failures has occured. The first one is:\n  ${message}`,
    trace,
    steps,
  };
};

const mergeActivityProcessingResults = (...results: readonly ActivityProcessingResult[]) => {
  return results.reduce(
    (target, { steps, files, apiCalls }) => {
      const { steps: targetSteps, files: targetFiles, apiCalls: targetApiCalls } = target;
      targetSteps.push(...steps);
      targetFiles.push(...files);
      targetApiCalls.push(...apiCalls);
      return target;
    },
    { steps: [], files: [], apiCalls: [] },
  );
};

const parseAttachments = async (
  createAttachmentFile: AttachmentFileFactory,
  attachments: readonly ShallowKnown<XcActionTestAttachment>[],
) => {
  const steps: RawStep[] = [];
  const files: ResultFile[] = [];

  for (const { name: rawName, timestamp, uuid: rawUuid, filename: rawFileName } of attachments) {
    const uuid = getString(rawUuid);
    if (uuid) {
      const start = getDate(timestamp);
      const name = getString(rawName) ?? DEFAULT_ATTACHMENT_NAME;
      const fileName = ensureUniqueFileName(rawFileName, name);
      const step: RawTestAttachment = {
        type: "attachment",
        originalFileName: fileName,
        name,
        start,
        stop: start,
      };
      const file = await createAttachmentFile(uuid, fileName);
      steps.push(step);
      if (file) {
        files.push(file);
      }
    }
  }
  return { steps, files, apiCalls: [] };
};

const ensureUniqueFileName = (byXc: Unknown<XcString>, byUser: string) =>
  getString(byXc) ?? `${randomUUID()}-${byUser}`;

const getAllTestResultParameters = (
  context: LegacyParsingState,
  args: Unknown<XcArray<XcTestArgument>>,
  repetition: Unknown<XcActionTestRepetitionPolicySummary>,
) =>
  [...convertActionParameters(context), convertRepetitionParameter(repetition), ...convertTestParameters(args)].filter(
    isDefined,
  );

const convertActionParameters = ({ destination, testPlan, multiTarget, multiTestPlan }: ActionParametersInputData) => {
  const parameters: RawTestParameter[] = [];
  if (multiTestPlan && testPlan) {
    // Doesn't affect the history. Only illustrates what test plan caused the test to be run
    parameters.push({ name: "Test plan", value: testPlan, excluded: true });
  }
  if (destination) {
    const { name, targetDetails } = destination;
    if (isDefined(name)) {
      parameters.push({ name: "Target", value: name, excluded: !multiTarget });
      if (multiTarget && targetDetails) {
        parameters.push({ name: "Target details", value: targetDetails });
      }
    }
  }
  return parameters;
};

const convertTestParameters = (args: Unknown<XcArray<XcTestArgument>>): (RawTestParameter | undefined)[] =>
  getObjectArray(args).map(({ parameter, value }) => {
    const parameterName = getParameterName(parameter);
    const argumentValue = getArgumentValue(value);
    return isDefined(parameterName) && isDefined(argumentValue)
      ? {
          name: parameterName,
          value: argumentValue,
        }
      : undefined;
  });

const convertRepetitionParameter = (
  repetition: Unknown<XcActionTestRepetitionPolicySummary>,
): RawTestParameter | undefined => {
  if (isObject(repetition)) {
    const { iteration, totalIterations } = repetition;
    const current = getInt(iteration);
    const total = getInt(totalIterations);
    if (current) {
      return {
        name: "Repetition",
        value: total ? `Repetition ${current} of ${total}` : `Repetition ${current}`,
        excluded: true,
      };
    }
  }
};

const parseProjectName = (url: string | undefined) => {
  if (url && url.startsWith(IDENTIFIER_URL_PREFIX)) {
    const urlPath = url.slice(IDENTIFIER_URL_PREFIX.length);
    const projectNameEnd = urlPath.indexOf("/");
    if (projectNameEnd !== -1) {
      const projectName = urlPath.slice(0, projectNameEnd);
      try {
        return decodeURIComponent(projectName);
      } catch {
        return projectName;
      }
    }
  }
};

const parseTestTags = (tags: Unknown<XcArray<XcTestTag>>): string[] =>
  getObjectArray(tags)
    .map(({ name }) => getString(name))
    .filter(isDefined);

const visitActionTestSummaryGroup = async function* (
  context: ParsingContext,
  { name, identifierURL, summary, subtests }: ShallowKnown<XcActionTestSummaryGroup>,
  state: LegacyParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const suiteId = getString(name);
  const suiteName = getString(summary) ?? suiteId ?? DEFAULT_SUITE_NAME;
  const suiteUri = getString(identifierURL);
  const { suites, className } = state;
  state = {
    ...state,
    suites: ensureSuiteNesting(suites, suiteUri, suiteName),
    className: className ?? suiteId,
  };
  yield* traverseActionTestSummaries(context, subtests, state);
};

const getParameterName = (parameter: Unknown<XcTestParameter>) =>
  isObject(parameter) ? getString(parameter.name) : undefined;

const getArgumentValue = (parameter: Unknown<XcTestValue>) =>
  isObject(parameter) ? getString(parameter.description) : undefined;
