import type { Readable } from "node:stream";

import type { AttachmentLink, TestFixtureResult, TestResult } from "@allurereport/core-api";

export type UploadCategoryGrouping = {
  key: string;
  value?: string;
  name?: string;
  type?: string;
};

export type UploadCategory = {
  externalId: string;
  name?: string;
  grouping?: UploadCategoryGrouping[];
  expand?: boolean;
  hide?: boolean;
};

export type UploadTestStatus = "failed" | "broken" | "passed" | "skipped" | "unknown";

export type UploadTestResultCategoryGroupingDto = {
  key?: string;
  value?: string;
  name?: string;
};

export type UploadTestResultCategoryDto = {
  id?: number;
  externalId?: string;
  grouping?: UploadTestResultCategoryGroupingDto[];
};

export type UploadTestResultNamedEnvDto = {
  id?: number;
  externalId?: string;
};

export type UploadAttachmentDto = {
  name?: string;
  originalFileName?: string;
  contentType?: string;
  contentLength?: number;
  optional?: boolean;
};

export type UploadParameterDto = {
  name?: string;
  value?: string;
  hidden?: boolean;
  excluded?: boolean;
  masked?: boolean;
};

export type UploadLinkDto = {
  name?: string;
  url?: string;
  type?: string;
};

export type UploadLabelDto = {
  name?: string;
  value?: string;
};

export type UploadTestResultBodyStepDto = {
  type: "body";
  body?: string;
  bodyJson?: unknown;
  status?: UploadTestStatus;
  start?: number;
  stop?: number;
  duration?: number;
  message?: string;
  trace?: string;
  parameters?: UploadParameterDto[];
  steps?: UploadTestResultStepDto[];
  expectedResultSteps?: UploadTestResultStepDto[];
};

export type UploadTestResultExpectedBodyStepDto = {
  type: "expected_body";
  body?: string;
  bodyJson?: unknown;
  status?: UploadTestStatus;
  start?: number;
  stop?: number;
  duration?: number;
  message?: string;
};

export type UploadTestResultAttachmentStepDto = {
  type: "attachment";
  attachment?: UploadAttachmentDto;
  status?: UploadTestStatus;
  start?: number;
  stop?: number;
  duration?: number;
};

export type UploadTestResultUnknownStepDto = {
  type?: string;
};

export type UploadTestResultStepDto =
  | UploadTestResultBodyStepDto
  | UploadTestResultExpectedBodyStepDto
  | UploadTestResultAttachmentStepDto
  | UploadTestResultUnknownStepDto;

export type UploadTestResultDto = {
  uuid?: string;
  historyId?: string;
  testCaseId?: string;
  name?: string;
  fullName?: string;
  description?: string;
  descriptionHtml?: string;
  precondition?: string;
  preconditionHtml?: string;
  expectedResult?: string;
  expectedResultHtml?: string;
  start?: number;
  stop?: number;
  duration?: number;
  status?: UploadTestStatus;
  message?: string;
  trace?: string;
  hostId?: string;
  threadId?: string;
  environment?: string;
  category?: UploadTestResultCategoryDto;
  namedEnv?: UploadTestResultNamedEnvDto;
  steps?: UploadTestResultStepDto[];
  attachments?: UploadAttachmentDto[];
  parameters?: UploadParameterDto[];
  links?: UploadLinkDto[];
  labels?: UploadLabelDto[];
};

export type UploadResultsDto = {
  testSessionId: number;
  results?: UploadTestResultDto[];
};

export type UploadTestResultResponseDto = {
  id?: number;
  uuid?: string;
};

export type UploadResultsResponseDto = {
  results?: UploadTestResultResponseDto[];
};

export type UploadTestFixtureType = "BEFORE" | "AFTER";

export type UploadTestFixtureResultDto = {
  type?: UploadTestFixtureType;
  uuid?: string;
  name?: string;
  start?: number;
  stop?: number;
  duration?: number;
  status?: UploadTestStatus;
  message?: string;
  trace?: string;
  steps?: UploadTestResultStepDto[];
};

export type UploadFixturesResultsDto = {
  fixtures?: UploadTestFixtureResultDto[];
};

export type TestResultWithCategories = Pick<
  TestResult,
  "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment"
> & {
  categories?: {
    id?: string;
    name: string;
    grouping?: UploadCategoryGrouping[];
    hide?: boolean;
    expand?: boolean;
  }[];
};

export interface TestOpsPluginTestResult extends TestResult {
  category?: UploadCategory & { id?: number };
  namedEnv?: {
    id: number;
  };
  message?: string;
  trace?: string;
  /**
   * The id of the test result in the Allure Report
   * Used to match the test result from TestOps with the report's one
   */
  uuid?: string;
}

export type LaunchCategoryBulkItem = {
  externalId: string;
  name: string;
  expand?: boolean;
  hide?: boolean;
};

export type LaunchCategoryBulkResult = {
  id: number;
  externalId: string;
};

export type TestOpsClientParams = {
  baseUrl: string;
  projectId: string;
  accessToken: string;
  limit?: number;
};

export type AttachmentForUpload = {
  originalFileName: string;
  contentType: string;
  content: Buffer | Blob | ReadableStream | Readable;
};

export type FixtureResolver = (tr: TestResult) => Promise<TestOpsFixtureResult[]>;
export type AttachmentsResolver = (tr: TestResult) => Promise<AttachmentForUpload[] | AttachmentForUpload>;

export type TestOpsUploaderOptions = {
  endpoint: string;
  accessToken: string;
  projectId: string;
  launchName: string;
  launchTags: string[];
  autocloseLaunch?: boolean;
  filter?: (testResult: TestResult) => boolean;
  limit?: number;
};

export interface TestOpsFixtureResult extends Omit<TestFixtureResult, "type"> {
  type: "BEFORE" | "AFTER";
}

export type TemplateManifest = Record<string, string>;

export type TestOpsPluginOptions = TestOpsUploaderOptions;

export type TestOpsSession = {
  id: number;
  jobId: number;
  jobRunId: number;
  launchId: number;
  projectId: number;
};

export type TestOpsLaunch = {
  id: number;
  name: string;
  closed: boolean;
  external: boolean;
  autoclose: boolean;
  projectId: number;
  tags: string[];
  links: [];
  issues: [];
  createdDate: number;
  lastModifiedDate: number;
};

export interface TestResultWithAttachments extends TestResult {
  attachments: AttachmentLink[];
}

export type TestOpsNamedEnv = {
  id: number;
  name: string;
  externalId: string;
  jobRunId?: number;
  launchId?: number;
};

export type TestOpsLaunchQualityGate = {
  id: number;
  launchId: number;
  jobRunId?: number;
  namedEnvId?: number;
  name: string;
  message?: string;
};
