export type XcTestResultCollection = {
  testPlanConfigurations: XcTestPlanConfiguration[];
  devices: XcTestRunDevice[];
  testNodes: XcTestResultNode[];
};

export type XcTestDetails = {
  testIdentifier: string;
  testName: string;
  testDescription: string;
  duration: string;
  startTime?: number;
  testPlanConfiguration: XcTestPlanConfiguration[];
  devices: XcTestRunDevice[];
  arguments?: XcTestResultArgument[];
  testRuns: XcTestResultNode[];
  testResult: XcTestResult;
  hasPerformanceMetrics: boolean;
  hasMediaAttachments: boolean;
  tags?: string[];
  bugs?: XcBug[];
  functionName?: string;
};

export type XcTestActivityCollection = {
  testIdentifier: string;
  testName: string;
  testRuns: XcTestRunActivity[];
};

export type XcTestRunActivity = {
  device: XcTestRunDevice;
  testPlanConfiguration: XcTestPlanConfiguration;
  arguments?: XcTestRunArgument[];
  activities: XcTestActivityNode[];
};

export type XcTestPlanConfiguration = {
  configurationId: string;
  configurationName: string;
};

export type XcTestRunDevice = {
  deviceId?: string;
  deviceName: string;
  architecture: string;
  modelName: string;
  platform?: string;
  osVersion: string;
};

export type XcTestRunArgument = {
  value: string;
};

export type XcTestActivityNode = {
  title: string;
  startTime?: number;
  attachments?: XcTestActivityAttachment[];
  childActivities?: XcTestActivityNode[];
};

export type XcTestActivityAttachment = {
  name: string;
  payloadId?: string;
  uuid: string;
  timestamp: number;
  lifetime?: string;
};

export type XcTestResultNode = {
  nodeIdentifier?: string;
  nodeType: XcTestNodeType;
  name: string;
  details?: string;
  duration?: string;
  result?: XcTestResult;
  tags?: string[];
  children?: XcTestResultNode[];
};

export type XcBug = {
  url?: string;
  identifier?: string;
  title?: string;
};

export const XcTestNodeTypeValues = [
  "Test Plan",
  "Unit test bundle",
  "UI test bundle",
  "Test Suite",
  "Test Case",
  "Device",
  "Test Plan Configuration",
  "Arguments",
  "Repetition",
  "Test Case Run",
  "Failure Message",
  "Source Code Reference",
  "Attachment",
  "Expression",
  "Test Value",
] as const;

export type XcTestNodeType = (typeof XcTestNodeTypeValues)[number];

export const XcTestResultValues = ["Passed", "Failed", "Skipped", "Expected Failure", "unknown"] as const;

export type XcTestResult = (typeof XcTestResultValues)[number];

export type XcTestResultArgument = {
  value: string;
};

export type XcTestAttachmentsManifestEntry = {
  attachments: XcTestAttachment[];
  testIdentifier: string;
};

export type XcTestAttachment = {
  configurationName: string;
  deviceId: string;
  deviceName: string;
  exportedFileName: string;
  isAssociatedWithFailure: boolean;
  suggestedHumanReadableName: string;
  timestamp: number;
};

export type XcParsingContext = {
  filename: string;
  suites: readonly string[];
  bundle?: string;
  attachmentsDir: string;
};

export type XcAttachments = Map<string, XcAttachmentMetadata[]>;

export type XcAttachmentMetadata = {
  path: string;
  name?: string;
  timestamp?: number;
};

export type TestDetailsRunData = {
  duration?: number;
  result?: XcTestResult;
  parameters?: (string | undefined)[];
  emitted?: boolean;
};

export type TestRunCoordinates = {
  device?: string;
  testPlan?: string;
  attempt?: number;
  args?: ({ name: string; value: string } | undefined)[];
};
