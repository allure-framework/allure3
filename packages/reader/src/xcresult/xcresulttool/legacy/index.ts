/* eslint max-lines: 0 */
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
import type { AllureApiCall } from "../../model.js";
import {
  DEFAULT_BUNDLE_NAME,
  DEFAULT_EXPECTED_FAILURE_REASON,
  DEFAULT_STEP_NAME,
  DEFAULT_SUITE_ID,
  DEFAULT_SUITE_NAME,
  DEFAULT_TEST_NAME,
  applyApiCalls,
  createTestLabels,
  getDefaultAttachmentName,
  getMediaTypeByUti,
  getTargetDetails,
  getWorstStatusWithDetails,
  parseAsAllureApiActivity,
  prependTitle,
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
  ResolvedTestFailure,
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
  getTestClassFromSuites,
  resolveFailureStepStatus,
  resolveTestStatus,
  withNewSuite,
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
  XcActionTestNoticeSummary,
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
    skipNoticeSummary,
  }: ShallowKnown<XcActionTestSummary>,
  state: LegacyParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { bundle, suites, destination: { hostName } = {} } = state;

  const fullName = getString(identifierURL) ?? randomUUID();
  const projectName = parseProjectName(fullName);
  const functionName = getString(rawName);
  const name = getString(summary) ?? functionName ?? DEFAULT_TEST_NAME;
  const status = getString(testStatus);

  const labels = createTestLabels({
    hostName,
    projectName,
    bundle,
    functionName,
    suites: suites.map(({ name: suite }) => suite),
    className: getTestClassFromSuites(suites),
    tags: parseTestTags(tags),
  });

  const parameters = getAllTestResultParameters(state, args, repetitionPolicySummary);
  const failures = await processFailures(createAttachmentFile, failureSummaries, expectedFailures);

  const {
    steps: activitySteps,
    files,
    apiCalls,
  } = await processActivities(createAttachmentFile, failures, getObjectArray(activitySummaries));

  const {
    message,
    trace,
    steps: failureSteps,
    status: worstFailedStepStatus,
  } = resolveTestFailures(failures, skipNoticeSummary);

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
    status: resolveTestStatus(status, worstFailedStepStatus),
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
      const issueId = getString(identifier);
      const name = getString(comment) ?? (issueId ? `Issue ${issueId}` : undefined);
      const url = getURL(rawUrl) ?? issueId;
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
  for (const { uuid, failureReason, failureSummary, isTopLevelFailure } of getObjectArray(expectedFailures)) {
    if (isObject(failureSummary)) {
      const mapMessage = (message: string | undefined) => {
        const prefix = getString(failureReason) ?? DEFAULT_EXPECTED_FAILURE_REASON;
        return message ? prependTitle(`${prefix}:`, message, 2) : prefix;
      };

      const entry = await toFailureMapEntry(createAttachmentFile, failureSummary, {
        uuid,
        status: "passed",
        isTopLevel: getBool(isTopLevelFailure),
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
  { uuid: explicitUuid, mapMessage, status: explicitStatus, isTopLevel: explicitTopLevelFlag }: FailureOverrides = {},
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
          isTopLevel: explicitTopLevelFlag ?? getBool(isTopLevelFailure),
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
  const steps: RawStep[] = [];
  const files: ResultFile[] = [];
  const apiCalls: AllureApiCall[] = [];
  const failureSteps: RawTestStepResult[] = [];
  for (const {
    activityType,
    title,
    start,
    finish,
    attachments: rawAttachments,
    subactivities: rawSubactivities,
    failureSummaryIDs,
    expectedFailureIDs,
  } of activities) {
    const attachments = getObjectArray(rawAttachments);
    const subactivities = getObjectArray(rawSubactivities);
    const failureIds = getStringArray(failureSummaryIDs);
    const expectedFailureIds = getStringArray(expectedFailureIDs);

    const { steps: thisStepAttachmentSteps, files: thisStepFiles } = await parseAttachments(
      createAttachmentFile,
      attachments,
    );
    if (getString(activityType) === ACTIVITY_TYPE_ATTACHMENT) {
      files.push(...thisStepFiles);
      steps.push(...thisStepAttachmentSteps);
      continue;
    }

    const name = getString(title);

    if (attachments.length === 0 && subactivities.length === 0 && failureIds.length === 0) {
      const parsedAllureApiCall = parseAsAllureApiActivity(name);
      if (isDefined(parsedAllureApiCall)) {
        apiCalls.push(parsedAllureApiCall);
        continue;
      }
    }

    const {
      steps: activitySubsteps,
      files: substepFiles,
      apiCalls: substepApiCalls,
      failureSteps: substepFailureSteps,
    } = await processActivities(createAttachmentFile, failures, subactivities);

    const { directFailureSteps, transitiveFailureSteps, message, trace, status } = resolveStepFailures(
      failureIds,
      expectedFailureIds,
      failures,
      substepFailureSteps,
    );

    const substeps = toSortedSteps(thisStepAttachmentSteps, activitySubsteps, directFailureSteps);

    steps.push({
      type: "step",
      name: name ?? DEFAULT_STEP_NAME,
      start: getDate(start),
      stop: getDate(finish),
      status: status ?? "passed",
      message,
      trace,
      steps: substeps,
    });
    files.push(...thisStepFiles, ...substepFiles);
    apiCalls.push(...substepApiCalls);
    failureSteps.push(...transitiveFailureSteps);
  }

  fillDefaultAttachmentNames(steps);

  return { steps, files, apiCalls, failureSteps };
};

const fillDefaultAttachmentNames = (steps: readonly RawStep[]) => {
  const attachmentSteps = steps.filter((s) => s.type === "attachment");
  const totalAttachments = attachmentSteps.length;
  attachmentSteps.forEach((s, i) => {
    s.name ??= getDefaultAttachmentName(i, totalAttachments);
  });
};

const resolveStepFailures = (
  failureUids: readonly string[],
  expectedFailureUids: readonly string[],
  failures: FailureMap,
  failureStepsOfSubsteps: RawTestStepResult[],
): ResolvedStepFailure => {
  const stepFailures = [...failureUids, ...expectedFailureUids].map((uuid) => failures.get(uuid));

  const directFailureSteps = resolveStepFailureSubsteps(stepFailures);
  const transitiveFailureSteps = toSortedSteps(directFailureSteps, failureStepsOfSubsteps);
  const { status, trace, message } = getWorstStatusWithDetails(transitiveFailureSteps) ?? {};

  return { status, message, trace, directFailureSteps, transitiveFailureSteps };
};

const resolveTestFailures = (
  failures: FailureMap,
  skipNoticeSummary: Unknown<XcActionTestNoticeSummary>,
): ResolvedTestFailure => {
  const allFailures = Array.from(failures.values());
  const transitiveFailureSteps = allFailures.map(({ step }) => step);

  const { status, trace, message } = getWorstStatusWithDetails(transitiveFailureSteps) ?? {};

  const steps = resolveTestFailureSteps(allFailures);

  if (!message && !trace && isObject(skipNoticeSummary)) {
    const { fileName, lineNumber, message: skipMessage } = skipNoticeSummary;
    return {
      steps,
      status,
      message: getString(skipMessage),
      trace: convertTraceLine(undefined, getString(fileName), getInt(lineNumber)),
    };
  }
  return { status, message, trace, steps };
};

const resolveTestFailureSteps = (failures: readonly FailureMapValue[]) =>
  failures.filter(({ isTopLevel }) => isTopLevel).map(({ step }) => step);

const resolveStepFailureSubsteps = (stepFailures: readonly (FailureMapValue | undefined)[]) => {
  return stepFailures.map(
    (failure) =>
      failure?.step ??
      ({
        type: "step",
        duration: 0,
        message: "An unknown failure has occured",
        status: "broken",
      } as RawTestStepResult),
  );
};

const parseAttachments = async (
  createAttachmentFile: AttachmentFileFactory,
  attachments: readonly ShallowKnown<XcActionTestAttachment>[],
) => {
  const steps: RawStep[] = [];
  const files: ResultFile[] = [];
  for (const { name: rawName, timestamp, uuid: rawUuid, filename: rawFileName, uniformTypeIdentifier } of attachments) {
    const uuid = getString(rawUuid);
    if (uuid) {
      const start = getDate(timestamp);
      const name = getString(rawName);
      const fileName = ensureUniqueFileName(rawFileName);
      const step: RawTestAttachment = {
        type: "attachment",
        originalFileName: fileName,
        name,
        start,
        stop: start,
        contentType: getMediaTypeByUti(getString(uniformTypeIdentifier)),
      };
      const file = await createAttachmentFile(uuid, fileName);
      steps.push(step);
      if (file) {
        files.push(file);
      }
    }
  }

  return { steps, files };
};

const ensureUniqueFileName = (fileName: Unknown<XcString>) => getString(fileName) ?? randomUUID();

const getAllTestResultParameters = (
  state: LegacyParsingState,
  args: Unknown<XcArray<XcTestArgument>>,
  repetition: Unknown<XcActionTestRepetitionPolicySummary>,
) =>
  [...convertActionParameters(state), convertRepetitionParameter(repetition), ...convertTestParameters(args)].filter(
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
      parameters.push({ name: "Device", value: name });
      if (multiTarget && targetDetails) {
        parameters.push({ name: "Device details", value: targetDetails, excluded: true });
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
  const { suites: parentSuites } = state;
  const suites = withNewSuite(parentSuites, suiteId ?? DEFAULT_SUITE_ID, suiteUri, suiteName);
  yield* traverseActionTestSummaries(context, subtests, { ...state, suites });
};

const getParameterName = (parameter: Unknown<XcTestParameter>) =>
  isObject(parameter) ? getString(parameter.name) : undefined;

const getArgumentValue = (parameter: Unknown<XcTestValue>) =>
  isObject(parameter) ? getString(parameter.description) : undefined;
