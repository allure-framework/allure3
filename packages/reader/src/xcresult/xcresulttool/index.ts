import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
} from "@allurereport/reader-api";
import { randomUUID } from "node:crypto";
import {
  ensureArray,
  ensureArrayWithItems,
  ensureInt,
  ensureLiteral,
  ensureObject,
  ensureString,
  isArray,
  isLiteral,
  isNumber,
  isObject,
  isString,
} from "../../validation.js";
import type { ShallowKnown, Unknown } from "../../validation.js";
import type { TestDetailsRunData, TestRunCoordinates, TestRunSelector } from "../model.js";
import {
  DEFAULT_BUNDLE_NAME,
  DEFAULT_SUITE_NAME,
  DEFAULT_TEST_NAME,
  createTestRunLookup,
  getTargetDetails,
  lookupNextTestAttempt,
  secondsToMilliseconds,
} from "../utils.js";
import { getTestActivities, getTestDetails, getTests } from "./cli.js";
import type { ApiParseFunction, AttachmentFileFactory, ParsingContext, ParsingState } from "./model.js";
import { XcTestNodeTypeValues, XcTestResultValues } from "./xcModel.js";
import type { XcActivityNode, XcAttachment, XcDevice, XcTestNode, XcTestResult, XcTestRunArgument } from "./xcModel.js";

const DURATION_PATTERN = /\d+\.\d+/;
const ATTACHMENT_NAME_INFIX_PATTERN = /_\d+_[\dA-F]{8}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{12}/g;

const parse: ApiParseFunction = async function* (
  context: ParsingContext,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { xcResultPath } = context;
  const tests = await getTests(xcResultPath);
  if (isObject(tests)) {
    const { testNodes } = tests;
    if (isArray(testNodes)) {
      yield* processXcNodes(context, testNodes, { suites: [] });
    }
  }
};

export default parse;

const processXcResultNode = async function* (
  ctx: ParsingContext,
  node: ShallowKnown<XcTestNode>,
  state: ParsingState,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { nodeType } = node;

  switch (ensureLiteral(nodeType, XcTestNodeTypeValues)) {
    case "Unit test bundle":
    case "UI test bundle":
      yield* processXcBundleNode(ctx, node, state);
    case "Test Suite":
      yield* processXcTestSuiteNode(ctx, node, state);
    case "Test Case":
      yield* processXcTestCaseNode(ctx, node, state);
  }
};

const processXcBundleNode = async function* (ctx: ParsingContext, node: ShallowKnown<XcTestNode>, state: ParsingState) {
  const { children, name } = node;

  yield* processXcNodes(ctx, ensureArray(children) ?? [], {
    ...state,
    bundle: ensureString(name) ?? DEFAULT_BUNDLE_NAME,
  });
};

const processXcTestSuiteNode = async function* (
  ctx: ParsingContext,
  node: ShallowKnown<XcTestNode>,
  state: ParsingState,
) {
  const { children, name } = node;
  const { suites } = state;

  yield* processXcNodes(ctx, ensureArray(children) ?? [], {
    ...state,
    suites: [...suites, ensureString(name) ?? DEFAULT_SUITE_NAME],
  });
};

const processXcTestCaseNode = async function* (
  { xcResultPath, createAttachmentFile }: ParsingContext,
  node: ShallowKnown<XcTestNode>,
  { bundle, suites }: ParsingState,
) {
  const { nodeIdentifier, name: displayName } = node;
  if (isString(nodeIdentifier)) {
    const testDetails = await getTestDetails(xcResultPath, nodeIdentifier);
    const testActivities = await getTestActivities(xcResultPath, nodeIdentifier);

    if (isObject(testDetails) && isObject(testActivities)) {
      const { testName, tags, testRuns: detailsTestRuns, devices: testDetailsDevices } = testDetails;

      const crossDeviceTesting = isArray(testDetailsDevices) && testDetailsDevices.length > 1;
      const detailsRunLookup = createTestDetailsRunLookup(detailsTestRuns);

      const name = ensureString(displayName) ?? ensureString(testName) ?? DEFAULT_TEST_NAME;
      const fullName = convertFullName(nodeIdentifier, bundle);
      const testCaseLabels = convertTestCaseLabels(bundle, suites, nodeIdentifier, tags);

      const { testRuns: activityTestRuns } = testActivities;
      for (const activityTestRun of ensureArrayWithItems(activityTestRuns, isObject) ?? []) {
        const {
          device: activityTestRunDevice,
          arguments: activityTestRunArguments,
          testPlanConfiguration: activityTestRunTestPlan,
          activities,
        } = activityTestRun;
        const {
          labels: deviceLabels,
          parameters: deviceParameters,
          deviceId,
        } = processActivityTestRunDevice(activityTestRunDevice, crossDeviceTesting);
        const { configurationId } = ensureObject(activityTestRunTestPlan) ?? {};
        const args = convertActivitiesTestRunArgs(activityTestRunArguments);

        const {
          duration,
          parameters = [],
          result = "unknown",
        } = findNextAttemptDataFromTestDetails(detailsRunLookup, {
          device: deviceId,
          testPlan: ensureString(configurationId),
          args,
        }) ?? {};

        const { steps, attachmentFiles } = await convertXcActivitiesToAllureSteps(createAttachmentFile, activities);

        yield* attachmentFiles;

        yield {
          uuid: randomUUID(),
          fullName,
          name,
          start: 0,
          duration: duration,
          status: convertXcResultToAllureStatus(result),
          message: "",
          trace: "",
          steps,
          labels: [...testCaseLabels, ...deviceLabels],
          links: [],
          parameters: [...deviceParameters, ...pairParameterNamesWithValues(parameters, args)],
        } as RawTestResult;
      }
    }
  }
};

const convertXcActivitiesToAllureSteps = async (
  createAttachmentFile: AttachmentFileFactory,
  activities: Unknown<XcActivityNode[]>,
  parentActivityAttachments: Iterator<{ potentialNames: Set<string>; uuid: string; xcName: string }> = [].values(),
): Promise<{ steps: RawStep[] | undefined; attachmentFiles: ResultFile[] }> => {
  const attachmentFiles: ResultFile[] = [];
  const steps: RawStep[] = [];
  let nextAttachmentOfParentActivity = parentActivityAttachments.next();
  for (const { title: unvalidatedTitle, attachments, childActivities, startTime } of ensureArrayWithItems(
    activities,
    isObject,
  ) ?? []) {
    const title = ensureString(unvalidatedTitle);
    const start = isNumber(startTime) ? secondsToMilliseconds(startTime) : undefined;

    const {
      potentialNames: potentialAttachmentNames,
      uuid: attachmentFileName,
      xcName,
    } = nextAttachmentOfParentActivity.done ? {} : nextAttachmentOfParentActivity.value;

    const isAttachment =
      isString(title) && isAttachmentActivity(potentialAttachmentNames, title, childActivities, attachments);

    if (isAttachment && attachmentFileName && xcName) {
      const file = await createAttachmentFile(attachmentFileName, xcName);
      if (file) {
        attachmentFiles.push(file);
      }

      nextAttachmentOfParentActivity = parentActivityAttachments.next();

      const attachmentStep = {
        type: "attachment",
        start,
        name: title,
        originalFileName: xcName,
      } as RawTestAttachment;

      steps.push(attachmentStep);

      continue;
    }

    const stepAttachments = (ensureArrayWithItems(attachments, isObject) ?? [])
      .map<
        { potentialNames: Set<string>; uuid: string; xcName: string } | undefined
      >(({ name, uuid }) => (isString(name) && isString(uuid) ? { potentialNames: getPotentialFileNamesFromXcSuggestedName(name), uuid, xcName: name } : undefined))
      .filter((entry) => typeof entry !== "undefined");

    const { steps: substeps, attachmentFiles: substepAttachmentFiles } = await convertXcActivitiesToAllureSteps(
      createAttachmentFile,
      childActivities,
      stepAttachments.values(),
    );

    const step = {
      type: "step",
      duration: 0,
      message: "",
      name: title,
      parameters: [],
      start,
      status: "passed",
      steps: substeps,
      stop: 0,
      trace: "",
    } as RawTestStepResult;

    attachmentFiles.push(...substepAttachmentFiles);
    steps.push(step);
  }

  return { steps, attachmentFiles };
};

const isAttachmentActivity = (
  potentialAttachmentNames: Set<string> | undefined,
  title: string,
  childActivities: Unknown<XcActivityNode[]>,
  attachments: Unknown<XcAttachment[]>,
) =>
  typeof childActivities === "undefined" &&
  typeof attachments === "undefined" &&
  (potentialAttachmentNames?.has(title) ?? false);

const getPotentialFileNamesFromXcSuggestedName = (xcSuggestedAttachmentName: string) =>
  new Set(
    [...xcSuggestedAttachmentName.matchAll(ATTACHMENT_NAME_INFIX_PATTERN)].map(
      ({ 0: { length }, index }) =>
        xcSuggestedAttachmentName.slice(0, index) + xcSuggestedAttachmentName.slice(index + length),
    ),
  );

const convertXcResultToAllureStatus = (xcResult: XcTestResult): RawTestStatus => {
  switch (xcResult) {
    case "Expected Failure":
      return "passed";
    case "Failed":
      return "failed";
    case "Passed":
      return "passed";
    case "Skipped":
      return "skipped";
    default:
      return "unknown";
  }
};

const pairParameterNamesWithValues = (
  names: readonly (string | undefined)[],
  values: readonly (string | undefined)[],
): RawTestParameter[] =>
  names
    .slice(0, values.length)
    .map((p, i) => {
      const value = values[i];
      return typeof p !== "undefined" && typeof value !== "undefined" ? { name: p, value } : undefined;
    })
    .filter((p) => typeof p !== "undefined");

const convertActivitiesTestRunArgs = (args: Unknown<XcTestRunArgument[]>): (string | undefined)[] =>
  isArray(args) ? args.map((a) => (isObject(a) && isString(a.value) ? a.value : undefined)) : [];

const createTestDetailsRunLookup = (nodes: Unknown<XcTestNode[]>) =>
  createTestRunLookup(collectRunsFromTestDetails(nodes));

const findNextAttemptDataFromTestDetails = (
  lookup: Map<string, Map<string, Map<string, TestDetailsRunData[]>>>,
  selector: TestRunSelector,
) => {
  const attempt = lookupNextTestAttempt(lookup, selector, ({ emitted }) => !emitted);
  if (attempt) {
    attempt.emitted = true;
  }
  return attempt;
};

const collectRunsFromTestDetails = (
  nodes: Unknown<XcTestNode[]>,
  coordinates: TestRunCoordinates = {},
): [TestRunCoordinates, TestDetailsRunData][] => {
  return (ensureArrayWithItems(nodes, isObject) ?? []).flatMap((node) => {
    const { children, duration, nodeIdentifier, name: nodeName, result } = node;
    let coordinateCreated = true;
    let repetition: number | undefined;
    switch (ensureLiteral(node.nodeType, XcTestNodeTypeValues)) {
      case "Device":
        if (isString(nodeIdentifier)) {
          coordinates = { ...coordinates, device: nodeIdentifier };
        }
      case "Repetition":
        repetition = ensureInt(nodeIdentifier);
        if (repetition) {
          coordinates = { ...coordinates, attempt: repetition };
        }
      case "Arguments":
        // If the test case is parametrized, the test-details/testRuns tree contains nested 'Arguments' nodes.
        // We're only interested in the outmost ones; nested nodes can be safely ignored.
        if ("args" in coordinates) {
          return [];
        }

        if (isString(nodeName)) {
          coordinates = { ...coordinates, args: extractArguments(children) };
        }
      case "Test Plan Configuration":
        if (isString(nodeIdentifier)) {
          coordinates = { ...coordinates, testPlan: nodeIdentifier };
        }
      default:
        coordinateCreated = false;
    }

    const runs = collectRunsFromTestDetails(children, coordinates);
    return runs.length
      ? runs
      : coordinateCreated
        ? [
            coordinates,
            {
              duration: parseDuration(duration),
              parameters: coordinates.args?.map((arg) => arg?.parameter) ?? [],
              result: ensureLiteral(result, XcTestResultValues) ?? "unknown",
            },
          ]
        : [];
  });
};

const extractArguments = (nodes: Unknown<XcTestNode[]>) => {
  if (isArray(nodes)) {
    const argumentsNodeIndex = nodes.findIndex((node) => isObject(node) && isLiteral(node.nodeType, ["Arguments"]));
    const { children } = nodes.splice(argumentsNodeIndex, 1)[0] as any as ShallowKnown<XcTestNode>;
    return (ensureArrayWithItems(children, isObject) ?? [])
      .filter(({ nodeType }) => isLiteral(nodeType, ["Test Value"]))
      .map(({ name }) => {
        if (isString(name) && name) {
          const colonIndex = name.indexOf(":");
          if (colonIndex !== -1) {
            return {
              parameter: name.slice(0, colonIndex).trim(),
              value: name.slice(colonIndex + 1).trim(),
            };
          }
        }
      });
  }
  return [];
};

const convertFullName = (testId: string, testBundle: string | undefined) =>
  testBundle ? `${testBundle}/${testId}` : testId;

const convertTestCaseLabels = (
  bundle: string | undefined,
  suites: readonly string[],
  testId: string,
  tags: Unknown<string[]>,
) => {
  const labels: RawTestLabel[] = [];

  if (bundle) {
    labels.push({ name: "package", value: bundle });
  }

  const [testClass, testMethod] = convertTestClassAndMethod(testId);

  if (testClass) {
    labels.push({ name: "testClass", value: testClass });
  }

  if (testMethod) {
    labels.push({ name: "testMethod", value: testMethod });
  }

  if (suites.length) {
    if (suites.length === 1) {
      labels.push({ name: "suite", value: suites[0] });
    }
    if (suites.length === 2) {
      labels.push({ name: "suite", value: suites[0] }, { name: "subSuite", value: suites[1] });
    } else {
      const [parentSuite, suite, ...subSuites] = suites;
      labels.push(
        { name: "parentSuite", value: parentSuite },
        { name: "suite", value: suite },
        { name: "subSuite", value: subSuites.join(" > ") },
      );
    }
  }

  labels.push(...(ensureArrayWithItems(tags, isString)?.map((t) => ({ name: "tag", value: t })) ?? []));

  return labels;
};

const processActivityTestRunDevice = (device: Unknown<XcDevice>, showDevice: boolean) => {
  const labels: RawTestLabel[] = [];
  const parameters: RawTestParameter[] = [];

  const { architecture, deviceId, deviceName, modelName, osVersion, platform } = ensureObject(device) ?? {};

  const host = convertHost(device);
  if (isString(deviceName) && deviceName) {
    labels.push({ name: "host", value: host });
    parameters.push({ name: "Target", value: deviceName, hidden: !showDevice });
    if (showDevice) {
      const targetDetails = getTargetDetails({
        architecture: ensureString(architecture),
        model: ensureString(modelName),
        platform: ensureString(platform),
        osVersion: ensureString(osVersion),
      });
      if (targetDetails) {
        parameters.push({ name: "Target details", value: targetDetails, excluded: true });
      }
    }
  }

  return { labels, parameters, deviceId: ensureString(deviceId) };
};

const convertHost = (device: Unknown<XcDevice>) => {
  if (isObject(device)) {
    const { deviceName, deviceId } = device;
    return ensureString(deviceName) ?? ensureString(deviceId);
  }
};

const convertTestClassAndMethod = (testId: string) => {
  const parts = testId.split("/");
  return [parts.slice(0, -1).join("."), parts.at(-1)];
};

const processXcNodes = async function* (
  ctx: ParsingContext,
  children: readonly Unknown<XcTestNode>[],
  state: ParsingState,
) {
  for (const child of children) {
    if (isObject(child)) {
      yield* processXcResultNode(ctx, child, state);
    }
  }
};

const parseDuration = (duration: Unknown<string>) => {
  if (isString(duration)) {
    const match = DURATION_PATTERN.exec(duration);
    if (match) {
      return secondsToMilliseconds(parseFloat(match[0]));
    }
  }
};
