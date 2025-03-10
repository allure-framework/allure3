import type { RawTestLabel, RawTestLink, RawTestParameter } from "@allurereport/reader-api";
import type { XcTestResult } from "./xcresulttool/xcModel.js";

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
  args?: TestRunArgs;
};

export type TestRunArgs = ({ parameter: string; value: string } | undefined)[];

export type TestRunSelector = {
  device?: string;
  testPlan?: string;
  attempt?: number;
  args?: (string | undefined)[];
};

export type TestRunLookup<Data> = Map<string, Map<string, Map<string, Data[]>>>;

export type TargetDescriptor = {
  model?: string;
  architecture?: string;
  platform?: string;
  osVersion?: string;
};

export type AllureApiCallBase<Type extends string, Value> = {
  type: Type;
  value: Value;
};

export type AllureNameApiCall = AllureApiCallBase<"name", string>;
export type AllureDescriptionApiCall = AllureApiCallBase<"description", string>;
export type AllurePreconditionApiCall = AllureApiCallBase<"precondition", string>;
export type AllureExpectedResultApiCall = AllureApiCallBase<"expectedResult", string>;
export type AllureLabelApiCall = AllureApiCallBase<"label", RawTestLabel>;
export type AllureLinkApiCall = AllureApiCallBase<"link", RawTestLink>;
export type AllureParameterApiCall = AllureApiCallBase<"parameter", RawTestParameter>;
export type AllureFlakyApiCall = AllureApiCallBase<"flaky", boolean>;
export type AllureMutedApiCall = AllureApiCallBase<"muted", boolean>;
export type AllureKnownApiCall = AllureApiCallBase<"known", boolean>;

export type AllureApiCall =
  | AllureNameApiCall
  | AllureDescriptionApiCall
  | AllurePreconditionApiCall
  | AllureExpectedResultApiCall
  | AllureLabelApiCall
  | AllureLinkApiCall
  | AllureParameterApiCall
  | AllureFlakyApiCall
  | AllureMutedApiCall
  | AllureKnownApiCall;

export type LabelsInputData = {
  hostName: string | undefined;
  projectName: string | undefined;
  bundle: string | undefined;
  suites: readonly string[];
  className: string | undefined;
  functionName: string | undefined;
  tags: readonly string[];
};
