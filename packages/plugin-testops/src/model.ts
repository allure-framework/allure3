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
};

export type TestResultWithCategories = Pick<
  TestResult,
  "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment"
> & {
  categories?: { id?: string; name: string; grouping?: UploadCategoryGrouping[] }[];
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
