import type { ResultFile } from "@allurereport/plugin-api";
import type { RawStep, RawTestStatus, RawTestStepResult } from "@allurereport/reader-api";
import type { Unknown } from "../../../validation.js";
import type { AllureApiCall } from "../../model.js";
import type { XcString } from "./xcModel.js";

export type LegacyTestResultData = {
  issues: LegacyIssueTrackingMetadata[];
  trace?: string;
  steps: [];
};

export type LegacyIssueTrackingMetadata = {
  url: string;
  title?: string;
};

export type LegacyStepResultData = {
  trace?: string;
  steps: [];
};

export type LegacyActionDiscriminator = {
  destination: LegacyDestinationData | undefined;
  testPlan: string | undefined;
};

export type LegacyDestinationData = {
  name?: string;
  targetDetails?: string;
  hostName?: string;
};

export type ActivityProcessingResult = {
  steps: RawStep[];
  files: ResultFile[];
  apiCalls: AllureApiCall[];
};

export type Suite = {
  name: string;
  uri: string | undefined;
};

export type LegacyParsingState = {
  bundle?: string;
  suites: Suite[];
  className?: string;
  destination?: LegacyDestinationData;
  testPlan?: string;
  multiTarget: boolean;
  multiTestPlan: boolean;
};

export type ActionParametersInputData = Pick<
  LegacyParsingState,
  "destination" | "testPlan" | "multiTarget" | "multiTestPlan"
>;

export type ResolvedStepFailure = {
  message?: string;
  trace?: string;
  status?: RawTestStatus;
  steps: RawTestStepResult[];
};

export type FailureMapValue = {
  step: RawTestStepResult;
  files: ResultFile[];
  isTopLevel?: boolean;
};

export type FailureMap = Map<string, FailureMapValue>;

export type FailureOverrides = {
  uuid?: Unknown<XcString>;
  mapMessage?: (message: string | undefined) => string;
  status?: RawTestStatus;
  isTopLevel?: boolean;
};
