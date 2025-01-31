import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
  ResultsReader,
} from "@allurereport/reader-api";
import { PathResultFile } from "@allurereport/reader-api";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
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
} from "../parsing.js";
import type { ShallowValid, Unvalidated } from "../parsing.js";
import { XcTestNodeTypeValues, XcTestResultValues } from "./model.js";
import type {
  TestDetailsRunData,
  TestRunCoordinates,
  XcParsingContext,
  XcTestActivityAttachment,
  XcTestActivityNode,
  XcTestResult,
  XcTestResultNode,
  XcTestRunArgument,
  XcTestRunDevice,
} from "./model.js";
import { exportAttachments, getTestActivities, getTestDetails, getTests } from "./xcUtils.js";

const DEFAULT_BUNDLE_NAME = "The test bundle name is not defined";
const DEFAULT_SUITE_NAME = "The test suite name is not defined";
const DEFAULT_TEST_NAME = "The test name is not defined";

const SURROGATE_DEVICE_ID = randomUUID();
const SURROGATE_TEST_PLAN_ID = randomUUID();
const SURROGATE_ARGS_ID = randomUUID();

const MS_IN_S = 1_000;
const DURATION_PATTERN = /\d+\.\d+/;
const ATTACHMENT_NAME_INFIX_PATTERN = /_\d+_[\dA-F]{8}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{12}/g;

const readerId = "xcresult";

export const xcresult: ResultsReader = {
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    if (originalFileName.endsWith(".xfresult")) {
      let attachmentsDir: string | undefined;
      try {
        attachmentsDir = await mkdtemp("allure-");
        await exportAttachments(originalFileName, attachmentsDir);
        const tests = await getTests(originalFileName);
        if (isObject(tests)) {
          const { testNodes } = tests;
          if (isArray(testNodes)) {
            const ctx = { filename: originalFileName, suites: [], attachmentsDir };
            for await (const testResultOrAttachment of processXcNodes(ctx, testNodes)) {
              if ("readContent" in testResultOrAttachment) {
                await visitor.visitAttachmentFile(testResultOrAttachment, { readerId });
              } else {
                await visitor.visitTestResult(testResultOrAttachment, {
                  readerId,
                  metadata: { originalFileName },
                });
              }
            }
          }
        }
        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      } finally {
        if (attachmentsDir) {
          try {
            await rm(attachmentsDir, { recursive: true, force: true });
          } catch (e) {
            console.error("when parsing", originalFileName, "- can't remove the tmp dir", attachmentsDir, e);
          }
        }
      }
    }
    return false;
  },

  readerId: () => readerId,
};

const processXcResultNode = async function* (
  ctx: XcParsingContext,
  node: ShallowValid<XcTestResultNode>,
): AsyncGenerator<RawTestResult | ResultFile, void, unknown> {
  const { nodeType } = node;

  switch (ensureLiteral(nodeType, XcTestNodeTypeValues)) {
    case "Unit test bundle":
    case "UI test bundle":
      yield* processXcBundleNode(ctx, node);
    case "Test Suite":
      yield* processXcTestSuiteNode(ctx, node);
    case "Test Case":
      yield* processXcTestCaseNode(ctx, node);
  }
};

const processXcBundleNode = async function* (ctx: XcParsingContext, node: ShallowValid<XcTestResultNode>) {
  const { children, name } = node;

  yield* processXcNodes({ ...ctx, bundle: ensureString(name) ?? DEFAULT_BUNDLE_NAME }, ensureArray(children) ?? []);
};

const processXcTestSuiteNode = async function* (ctx: XcParsingContext, node: ShallowValid<XcTestResultNode>) {
  const { children, name } = node;

  yield* processXcNodes(
    { ...ctx, suites: [...ctx.suites, ensureString(name) ?? DEFAULT_SUITE_NAME] },
    ensureArray(children) ?? [],
  );
};

const processXcTestCaseNode = async function* (
  { filename, bundle, suites, attachmentsDir }: XcParsingContext,
  node: ShallowValid<XcTestResultNode>,
) {
  const { nodeIdentifier, name: displayName } = node;
  if (isString(nodeIdentifier)) {
    const testDetails = await getTestDetails(filename, nodeIdentifier);
    const testActivities = await getTestActivities(filename, nodeIdentifier);

    if (isObject(testDetails) && isObject(testActivities)) {
      const { testName, tags, testRuns: detailsTestRuns, devices: testDetailsDevices } = testDetails;

      const crossDeviceTesting = isArray(testDetailsDevices) && testDetailsDevices.length > 1;
      const detailsRunLookup = createTestDetailsRunLookup(detailsTestRuns);

      const name = ensureString(displayName) ?? ensureString(testName) ?? DEFAULT_TEST_NAME;
      const fullName = convertFullName(nodeIdentifier, bundle);
      const testCaseLabels = convertTestCaseLabels(bundle, suites, nodeIdentifier, tags);

      const { testRuns: activityTestRuns } = testActivities;
      for (const activityTestRun of ensureArrayWithItems(activityTestRuns, isObject)) {
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
        } = findNextAttemptDataFromTestDetails(detailsRunLookup, deviceId, ensureString(configurationId), args) ?? {};

        const { steps, attachmentFiles } = convertXcActivitiesToAllureSteps(attachmentsDir, activities);

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

const convertXcActivitiesToAllureSteps = (
  attachmentsDir: string,
  activities: Unvalidated<XcTestActivityNode[]>,
  parentActivityAttachments: Iterator<{ potentialNames: Set<string>; uuid: string }> = [].values(),
): { steps: RawStep[]; attachmentFiles: ResultFile[] } => {
  const attachmentFiles: ResultFile[] = [];
  let nextAttachmentOfParentActivity = parentActivityAttachments.next();
  return {
    steps: ensureArrayWithItems(activities, isObject).map<RawStep>(
      ({ title: unvalidatedTitle, attachments, childActivities, startTime }) => {
        const title = ensureString(unvalidatedTitle);
        const start = isNumber(startTime) ? secondsToMilliseconds(startTime) : undefined;

        const { potentialNames: potentialAttachmentNames, uuid: attachmentFileName } =
          nextAttachmentOfParentActivity.done ? {} : nextAttachmentOfParentActivity.value;

        const isAttachment =
          isString(title) && isAttachmentActivity(potentialAttachmentNames, title, childActivities, attachments);

        if (isAttachment && attachmentFileName) {
          const attachmentUuid = randomUUID();
          const attachmentPath = path.join(attachmentsDir, attachmentFileName);
          attachmentFiles.push(new PathResultFile(attachmentPath, attachmentUuid));

          nextAttachmentOfParentActivity = parentActivityAttachments.next();

          return {
            type: "attachment",
            start,
            name: title,
            originalFileName: attachmentUuid,
          } as RawTestAttachment;
        }

        const stepAttachments = ensureArrayWithItems(attachments, isObject)
          .map<{ potentialNames: Set<string>; uuid: string } | undefined>(({ name, uuid }) =>
            isString(name) && isString(uuid)
              ? { potentialNames: getPotentialFileNamesFromXcSuggestedName(name), uuid }
              : undefined,
          )
          .filter((entry) => typeof entry !== "undefined");

        const { steps: substeps, attachmentFiles: substepAttachmentFiles } = convertXcActivitiesToAllureSteps(
          attachmentsDir,
          childActivities,
          stepAttachments.values(),
        );

        attachmentFiles.push(...substepAttachmentFiles);

        return {
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
      },
    ),
    attachmentFiles,
  };
};

const isAttachmentActivity = (
  potentialAttachmentNames: Set<string> | undefined,
  title: string,
  childActivities: Unvalidated<XcTestActivityNode[]>,
  attachments: Unvalidated<XcTestActivityAttachment[]>,
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

const convertActivitiesTestRunArgs = (args: Unvalidated<XcTestRunArgument[]>): (string | undefined)[] =>
  isArray(args) ? args.map((a) => (isObject(a) && isString(a.value) ? a.value : undefined)) : [];

const createTestDetailsRunLookup = (nodes: Unvalidated<XcTestResultNode[]>) =>
  groupByMap(
    collectRunsFromTestDetails(nodes),
    ([{ device }]) => device ?? SURROGATE_DEVICE_ID,
    (deviceRuns) =>
      groupByMap(
        deviceRuns,
        ([{ testPlan: configuration }]) => configuration ?? SURROGATE_TEST_PLAN_ID,
        (configRuns) =>
          groupByMap(
            configRuns,
            ([{ args }]) => (args && args.length ? getArgKey(args.map((arg) => arg?.value)) : SURROGATE_ARGS_ID),
            (argRuns) => {
              // Make sure retries are ordered by the repetition index
              argRuns.sort(([{ attempt: attemptA }], [{ attempt: attemptB }]) => (attemptA ?? 0) - (attemptB ?? 0));
              return argRuns.map(([, data]) => data);
            },
          ),
      ),
  );

const groupBy = <T, K>(values: T[], keyFn: (v: T) => K): Map<K, T[]> =>
  values.reduce((m, v) => {
    const key = keyFn(v);
    if (!m.get(key)?.push(v)) {
      m.set(key, [v]);
    }
    return m;
  }, new Map<K, T[]>());

const groupByMap = <T, K, G>(values: T[], keyFn: (v: T) => K, groupMapFn: (group: T[]) => G): Map<K, G> =>
  new Map<K, G>(
    groupBy(values, keyFn)
      .entries()
      .map(([k, g]) => [k, groupMapFn(g)]),
  );

const findNextAttemptDataFromTestDetails = (
  lookup: Map<string, Map<string, Map<string, TestDetailsRunData[]>>>,
  device: string | undefined,
  testPlan: string | undefined,
  args: readonly (string | undefined)[] | undefined,
) => {
  const attempt = lookup
    .get(device ?? SURROGATE_DEVICE_ID)
    ?.get(testPlan ?? SURROGATE_TEST_PLAN_ID)
    ?.get(args && args.length ? getArgKey(args) : SURROGATE_ARGS_ID)
    ?.find(({ emitted }) => !emitted);
  if (attempt) {
    attempt.emitted = true;
  }
  return attempt;
};

const getArgKey = (args: readonly (string | undefined)[]) => args.filter((v) => typeof v !== "undefined").join(", ");

const collectRunsFromTestDetails = (
  nodes: Unvalidated<XcTestResultNode[]>,
  coordinates: TestRunCoordinates = {},
): [TestRunCoordinates, TestDetailsRunData][] => {
  return ensureArrayWithItems(nodes, isObject).flatMap((node) => {
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
              parameters: coordinates.args?.map((arg) => arg?.name) ?? [],
              result: ensureLiteral(result, XcTestResultValues) ?? "unknown",
            },
          ]
        : [];
  });
};

const extractArguments = (nodes: Unvalidated<XcTestResultNode[]>) => {
  if (isArray(nodes)) {
    const argumentsNodeIndex = nodes.findIndex((node) => isObject(node) && isLiteral(node.nodeType, ["Arguments"]));
    const { children } = nodes.splice(argumentsNodeIndex, 1)[0] as any as ShallowValid<XcTestResultNode>;
    return ensureArrayWithItems(children, isObject)
      .filter(({ nodeType }) => isLiteral(nodeType, ["Test Value"]))
      .map(({ name }) => {
        if (isString(name) && name) {
          const colonIndex = name.indexOf(":");
          if (colonIndex !== -1) {
            return {
              name: name.slice(0, colonIndex).trim(),
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
  tags: Unvalidated<string[]>,
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

  labels.push(...ensureArrayWithItems(tags, isString).map((t) => ({ name: "tag", value: t })));

  return labels;
};

const processActivityTestRunDevice = (device: Unvalidated<XcTestRunDevice>, showDevice: boolean) => {
  const labels: RawTestLabel[] = [];
  const parameters: RawTestParameter[] = [];

  const { architecture, deviceId, deviceName, modelName, osVersion, platform } = ensureObject(device) ?? {};

  const host = convertHost(device);
  if (isString(deviceName) && deviceName) {
    labels.push({ name: "host", value: host });
    parameters.push({ name: "Device name", value: deviceName, hidden: !showDevice });
    if (showDevice) {
      const osPart = isString(platform) ? (isString(osVersion) ? `${platform} ${osVersion}` : platform) : undefined;
      const deviceDetails = [modelName, architecture, osPart].filter(isString).join(", ");
      parameters.push({ name: "Device details", value: deviceDetails, excluded: true });
    }
  }

  return { labels, parameters, deviceId: ensureString(deviceId) };
};

const convertHost = (device: Unvalidated<XcTestRunDevice>) => {
  if (isObject(device)) {
    const { deviceName, deviceId } = device;
    return ensureString(deviceName) ?? ensureString(deviceId);
  }
};

const convertTestClassAndMethod = (testId: string) => {
  const parts = testId.split("/");
  return [parts.slice(0, -1).join("."), parts.at(-1)];
};

const processXcNodes = async function* (ctx: XcParsingContext, children: readonly Unvalidated<XcTestResultNode>[]) {
  for (const child of children) {
    if (isObject(child)) {
      yield* processXcResultNode(ctx, child);
    }
  }
};

const parseDuration = (duration: Unvalidated<string>) => {
  if (isString(duration)) {
    const match = DURATION_PATTERN.exec(duration);
    if (match) {
      return secondsToMilliseconds(parseFloat(match[0]));
    }
  }
};

const secondsToMilliseconds = (seconds: number) => Math.round(seconds * MS_IN_S);
