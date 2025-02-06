/**
 * `xcrun xcresulttool get test-results tests`
 */
export type XcTests = {
  testPlanConfigurations: XcConfiguration[];
  devices: XcDevice[];
  testNodes: XcTestNode[];
};

export type XcConfiguration = {
  configurationId: string;
  configurationName: string;
};

export type XcDevice = {
  deviceId?: string;
  deviceName: string;
  architecture: string;
  modelName: string;
  platform?: string;
  osVersion: string;
};

export type XcTestNode = {
  nodeIdentifier?: string;
  nodeType: XcTestNodeType;
  name: string;
  details?: string;
  duration?: string;
  result?: XcTestResult;
  tags?: string[];
  children?: XcTestNode[];
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

/**
 * `xcrun xcresulttool get test-results test-details --test-id '...'`, where --test-id is the value of
 * XcTests.testNodes[number](.children[number])*.nodeIdentifier
 */
export type XcTestDetails = {
  testIdentifier: string;
  testName: string;
  testDescription: string;
  duration: string;
  startTime?: number;
  testPlanConfiguration: XcConfiguration[];
  devices: XcDevice[];
  arguments?: XcTestResultArgument[];
  testRuns: XcTestNode[];
  testResult: XcTestResult;
  hasPerformanceMetrics: boolean;
  hasMediaAttachments: boolean;
  tags?: string[];
  bugs?: XcBug[];
  functionName?: string;
};

export type XcTestResultArgument = {
  value: string;
};

export type XcBug = {
  url?: string;
  identifier?: string;
  title?: string;
};

/**
 * `xcrun xcresulttool get test-results activities --test-id '...'`, where --test-id is the value of
 * XcTests.testNodes[number](.children[number])*.nodeIdentifier
 */
export type XcActivities = {
  testIdentifier: string;
  testName: string;
  testRuns: XcTestRunActivity[];
};

export type XcTestRunActivity = {
  device: XcDevice;
  testPlanConfiguration: XcConfiguration;
  arguments?: XcTestRunArgument[];
  activities: XcActivityNode[];
};

export type XcTestRunArgument = {
  value: string;
};

export type XcActivityNode = {
  title: string;
  startTime?: number;
  attachments?: XcAttachment[];
  childActivities?: XcActivityNode[];
};

export type XcAttachment = {
  name: string;
  payloadId?: string;
  uuid: string;
  timestamp: number;
  lifetime?: string;
};

/**
 * The type of the manifest entry created by `xcrun resulttool export attachments`
 */
export type XcTestAttachmentDetails = {
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
