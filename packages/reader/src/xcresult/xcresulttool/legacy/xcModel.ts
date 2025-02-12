export type XcObject<T extends string> = {
  _type: {
    _name: T;
  };
};

export type XcValue<Type extends string, Value> = XcObject<Type> & {
  _value: Value;
};

export type XcArray<Element> = XcObject<"Array"> & {
  _values: Element[];
};

export type XcSortedKeyValueArrayPair = XcObject<"SortedKeyValueArrayPair"> & {
  key: XcString;
  value: XcObject<string>;
};

export type XcSortedKeyValueArray = XcObject<"SortedKeyValueArray"> & {
  storage: XcArray<XcSortedKeyValueArrayPair>;
};

export type XcBool = XcValue<"Bool", boolean>;

export type XcData = XcValue<"Data", string>;

export type XcDate = XcValue<"Date", string>;

export type XcDouble = XcValue<"Double", number>;

export type XcInt = XcValue<"Int", number>;

export type XcInt16 = XcValue<"Int16", number>;

export type XcInt32 = XcValue<"Int32", number>;

export type XcInt64 = XcValue<"Int64", number>;

export type XcInt8 = XcValue<"Int8", number>;

export type XcString = XcValue<"String", string>;

export type XcUInt16 = XcValue<"UInt16", number>;

export type XcUInt32 = XcValue<"UInt32", number>;

export type XcUInt64 = XcValue<"UInt64", number>;

export type XcUInt8 = XcValue<"UInt8", number>;

export type XcURL = XcValue<"URL", string>;

export type XcReference = XcObject<"Reference"> & {
  id: XcString;
  targetType?: XcTypeDefinition;
};

/**
 * `xcrun xcresulttool get object` (without --id)
 */
export type XcActionsInvocationRecord = XcObject<"ActionsInvocationRecord"> & {
  metadataRef?: XcReference;
  metrics: XcResultMetrics;
  issues: XcResultIssueSummaries;
  actions: XcArray<XcActionRecord>;
  archive?: XcArchiveInfo;
};

export type XcResultMetrics = XcObject<"ResultMetrics"> & {
  analyzerWarningCount: XcInt;
  errorCount: XcInt;
  testsCount: XcInt;
  testsFailedCount: XcInt;
  testsSkippedCount: XcInt;
  warningCount: XcInt;
  totalCoveragePercentage?: XcDouble;
};

export type XcResultIssueSummaries = XcObject<"ResultIssueSummaries"> & {
  analyzerWarningSummaries: XcArray<XcIssueSummary>;
  errorSummaries: XcArray<XcIssueSummary>;
  testFailureSummaries: XcArray<XcTestFailureIssueSummary>;
  warningSummaries: XcArray<XcIssueSummary>;
  testWarningSummaries: XcArray<XcTestIssueSummary>;
};

export type XcActionRecord = XcObject<"ActionRecord"> & {
  schemeCommandName: XcString;
  schemeTaskName: XcString;
  title?: XcString;
  startedTime: XcDate;
  endedTime: XcDate;
  runDestination: XcActionRunDestinationRecord;
  buildResult: XcActionResult;
  actionResult: XcActionResult;
  testPlanName?: XcString;
};

export type XcArchiveInfo = XcObject<"ArchiveInfo"> & {
  path?: XcString;
};

export type XcTypeDefinition = XcObject<"TypeDefinition"> & {
  name: XcString;
  supertype?: XcTypeDefinition;
};

export type XcIssueSummary<Type extends string = "IssueSummary"> = XcObject<Type> & {
  issueType: XcString;
  message: XcString;
  producingTarget?: XcString;
  documentLocationInCreatingWorkspace?: XcDocumentLocation;
};

export type XcTestFailureIssueSummary = XcIssueSummary<"TestFailureIssueSummary"> & {
  testCaseName: XcString;
};

export type XcTestIssueSummary = XcIssueSummary<"TestIssueSummary"> & {
  testCaseName: XcString;
};

export type XcActionRunDestinationRecord = XcObject<"ActionRunDestinationRecord"> & {
  displayName: XcString;
  targetArchitecture: XcString;
  targetDeviceRecord: XcActionDeviceRecord;
  localComputerRecord: XcActionDeviceRecord;
  targetSDKRecord: XcActionSDKRecord;
};

export type XcActionResult = XcObject<"ActionResult"> & {
  resultName: XcString;
  status: XcString;
  metrics: XcResultMetrics;
  issues: XcResultIssueSummaries;
  coverage: XcCodeCoverageInfo;
  timelineRef?: XcReference;
  logRef?: XcReference;
  testsRef?: XcReference;
  diagnosticsRef?: XcReference;
  consoleLogRef?: XcReference;
};

export type XcDocumentLocation = XcObject<"DocumentLocation"> & {
  url: XcString;
  concreteTypeName: XcString;
};

export type XcActionDeviceRecord = XcObject<"ActionDeviceRecord"> & {
  name: XcString;
  isConcreteDevice: XcBool;
  operatingSystemVersion: XcString;
  operatingSystemVersionWithBuildNumber: XcString;
  nativeArchitecture: XcString;
  modelName: XcString;
  modelCode: XcString;
  modelUTI: XcString;
  identifier: XcString;
  isWireless: XcBool;
  cpuKind: XcString;
  cpuCount?: XcInt;
  cpuSpeedInMhz?: XcInt;
  busSpeedInMhz?: XcInt;
  ramSizeInMegabytes?: XcInt;
  physicalCPUCoresPerPackage?: XcInt;
  logicalCPUCoresPerPackage?: XcInt;
  platformRecord: XcActionPlatformRecord;
};

export type XcActionSDKRecord = XcObject<"ActionSDKRecord"> & {
  name: XcString;
  identifier: XcString;
  operatingSystemVersion: XcString;
  isInternal: XcBool;
};

export type XcCodeCoverageInfo = XcObject<"CodeCoverageInfo"> & {
  hasCoverageData: XcBool;
  reportRef?: XcReference;
  archiveRef?: XcReference;
};

export type XcActionPlatformRecord = XcObject<"ActionPlatformRecord"> & {
  identifier: XcString;
  userDescription: XcString;
};

/**
 * `xcrun xcresulttool get object --id '...'` with --id of XcActionsInvocationRecord.actions[number].actionResult.testsRef
 */
export type XcActionTestPlanRunSummaries = XcObject<"ActionTestPlanRunSummaries"> & {
  summaries: XcArray<XcActionTestPlanRunSummary>;
};

export type XcActionAbstractTestSummary<Type extends string> = XcObject<Type> & {
  name?: XcString;
};

export type XcActionTestPlanRunSummary = XcActionAbstractTestSummary<"ActionTestPlanRunSummary"> & {
  testableSummaries: XcArray<XcActionTestableSummary>;
};

export type XcActionTestableSummary = XcActionAbstractTestSummary<"ActionTestableSummary"> & {
  identifierURL?: XcString;
  projectRelativePath?: XcString;
  targetName?: XcString;
  testKind?: XcString;
  tests: XcArray<XcActionTestSummaryIdentifiableObject>;
  diagnosticsDirectoryName?: XcString;
  failureSummaries: XcArray<XcActionTestFailureSummary>;
  testLanguage?: XcString;
  testRegion?: XcString;
};

export type XcActionTestSummaryIdentifiableObjectBase<Type extends string> = XcActionAbstractTestSummary<Type> & {
  identifier?: XcString;
  identifierURL?: XcString;
};

export type XcActionTestMetadata = XcActionTestSummaryIdentifiableObjectBase<"ActionTestMetadata"> & {
  testStatus: XcString;
  duration?: XcDouble;
  summaryRef?: XcReference;
  performanceMetricsCount?: XcInt;
  failureSummariesCount?: XcInt;
  activitySummariesCount?: XcInt;
};

export type XcActionTestSummaryGroup = XcActionTestSummaryIdentifiableObjectBase<"ActionTestSummaryGroup"> & {
  duration: XcDouble;
  subtests: XcArray<XcActionTestSummaryIdentifiableObject>;
  skipNoticeSummary?: XcActionTestNoticeSummary;
  summary?: XcString;
  documentation: XcArray<XcTestDocumentation>;
  trackedIssues: XcArray<XcIssueTrackingMetadata>;
  tags: XcArray<XcTestTag>;
};

/**
 * `xcrun xcresulttool get object --id '...'` with --id of
 * XcActionTestPlanRunSummaries.summaries[number].testableSummaries[number].tests[number](.subtests[number])*.summaryRef
 */
export type XcActionTestSummary = XcActionTestSummaryIdentifiableObjectBase<"ActionTestSummary"> & {
  testStatus: XcString;
  duration: XcDouble;
  performanceMetrics: XcArray<XcActionTestPerformanceMetricSummary>;
  failureSummaries: XcArray<XcActionTestFailureSummary>;
  expectedFailures: XcArray<XcActionTestExpectedFailure>;
  skipNoticeSummary?: XcActionTestNoticeSummary;
  activitySummaries: XcArray<XcActionTestActivitySummary>;
  repetitionPolicySummary?: XcActionTestRepetitionPolicySummary;
  arguments: XcArray<XcTestArgument>;
  configuration?: XcActionTestConfiguration;
  warningSummaries: XcArray<XcActionTestIssueSummary>;
  summary?: XcString;
  documentation: XcArray<XcTestDocumentation>;
  trackedIssues: XcArray<XcIssueTrackingMetadata>;
  tags: XcArray<XcTestTag>;
};

export type XcActionTestSummaryIdentifiableObject =
  | XcActionTestMetadata
  | XcActionTestSummary
  | XcActionTestSummaryGroup;

export const XcActionTestSummaryIdentifiableObjectTypes = [
  "ActionTestMetadata",
  "ActionTestSummary",
  "ActionTestSummaryGroup",
] as const;

export type XcActionTestFailureSummary = XcObject<"ActionTestFailureSummary"> & {
  message?: XcString;
  fileName: XcString;
  lineNumber: XcInt;
  isPerformanceFailure: XcBool;
  uuid: XcString;
  issueType?: XcString;
  detailedDescription?: XcString;
  attachments: XcArray<XcActionTestAttachment>;
  associatedError?: XcTestAssociatedError;
  sourceCodeContext?: XcSourceCodeContext;
  timestamp?: XcDate;
  isTopLevelFailure: XcBool;
  expression?: XcTestExpression;
};

export type XcActionTestAttachment = XcObject<"ActionTestAttachment"> & {
  uniformTypeIdentifier: XcString;
  name?: XcString;
  uuid?: XcString;
  timestamp?: XcDate;
  userInfo?: XcSortedKeyValueArray;
  lifetime: XcString;
  inActivityIdentifier: XcInt;
  filename?: XcString;
  payloadRef?: XcReference;
  payloadSize: XcInt;
};

export type XcTestAssociatedError = XcObject<"TestAssociatedError"> & {
  domain?: XcString;
  code?: XcInt;
  userInfo?: XcSortedKeyValueArray;
};

export type XcSourceCodeContext = XcObject<"SourceCodeContext"> & {
  location?: XcSourceCodeLocation;
  callStack: XcArray<XcSourceCodeFrame>;
};

export type XcTestExpression = XcObject<"TestExpression"> & {
  sourceCode: XcString;
  value?: XcTestValue;
  subexpressions: XcArray<XcTestExpression>;
};

export type XcSourceCodeLocation = XcObject<"SourceCodeLocation"> & {
  filePath?: XcString;
  lineNumber?: XcInt;
};

export type XcSourceCodeFrame = XcObject<"SourceCodeFrame"> & {
  addressString?: XcString;
  symbolInfo?: XcSourceCodeSymbolInfo;
};

export type XcSourceCodeSymbolInfo = XcObject<"SourceCodeSymbolInfo"> & {
  imageName?: XcString;
  symbolName?: XcString;
  location?: XcSourceCodeLocation;
};

export type XcActionTestPerformanceMetricSummary = XcObject<"ActionTestPerformanceMetricSummary"> & {
  displayName: XcString;
  unitOfMeasurement: XcString;
  measurements: XcArray<XcDouble>;
  identifier?: XcString;
  baselineName?: XcString;
  baselineAverage?: XcDouble;
  maxPercentRegression?: XcDouble;
  maxPercentRelativeStandardDeviation?: XcDouble;
  maxRegression?: XcDouble;
  maxStandardDeviation?: XcDouble;
  polarity?: XcString;
};

export type XcActionTestExpectedFailure = XcObject<"ActionTestExpectedFailure"> & {
  uuid: XcString;
  failureReason?: XcString;
  failureSummary?: XcActionTestFailureSummary;
  isTopLevelFailure: XcBool;
};

export type XcActionTestNoticeSummary = XcObject<"ActionTestNoticeSummary"> & {
  message?: XcString;
  fileName: XcString;
  lineNumber: XcInt;
  timestamp?: XcDate;
};

export type XcActionTestActivitySummary = XcObject<"ActionTestActivitySummary"> & {
  title: XcString;
  activityType: XcString;
  uuid: XcString;
  start?: XcDate;
  finish?: XcDate;
  attachments: XcArray<XcActionTestAttachment>;
  subactivities: XcArray<XcActionTestActivitySummary>;
  failureSummaryIDs: XcArray<XcString>;
  expectedFailureIDs: XcArray<XcString>;
  warningSummaryIDs: XcArray<XcString>;
};

export type XcActionTestRepetitionPolicySummary = XcObject<"ActionTestRepetitionPolicySummary"> & {
  iteration?: XcInt;
  totalIterations?: XcInt;
  repetitionMode?: XcString;
};

export type XcTestArgument = XcObject<"TestArgument"> & {
  parameter?: XcTestParameter;
  identifier?: XcString;
  description: XcString;
  debugDescription?: XcString;
  typeName?: XcString;
  value: XcTestValue;
};

export type XcActionTestConfiguration = XcObject<"ActionTestConfiguration"> & {
  values: XcSortedKeyValueArray;
};

export type XcActionTestIssueSummary = XcObject<"ActionTestIssueSummary"> & {
  message?: XcString;
  fileName: XcString;
  lineNumber: XcInt;
  uuid: XcString;
  issueType?: XcString;
  detailedDescription?: XcString;
  attachments: XcArray<XcActionTestAttachment>;
  associatedError?: XcTestAssociatedError;
  sourceCodeContext?: XcSourceCodeContext;
  timestamp?: XcDate;
};

export type XcTestDocumentation = XcObject<"TestDocumentation"> & {
  content: XcString;
  format: XcString;
};

export type XcIssueTrackingMetadata = XcObject<"IssueTrackingMetadata"> & {
  identifier: XcString;
  url?: XcURL;
  comment?: XcString;
  summary: XcString;
};

export type XcTestTag = XcObject<"TestTag"> & {
  identifier: XcString;
  name: XcString;
  anchors: XcArray<XcString>;
};

export type XcTestParameter = XcObject<"TestParameter"> & {
  label: XcString;
  name?: XcString;
  typeName?: XcString;
  fullyQualifiedTypeName?: XcString;
};

export type XcTestValue = XcObject<"TestValue"> & {
  description: XcString;
  debugDescription?: XcString;
  typeName?: XcString;
  fullyQualifiedTypeName?: XcString;
  label?: XcString;
  isCollection: XcBool;
  children: XcArray<XcTestValue>;
};
