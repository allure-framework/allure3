import type { AttachmentLink, TestResult } from "@allurereport/core-api";

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

export type TestResultWithUploadCategory = TestResult & {
  category?: UploadCategory & { id?: number };
};

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
  content: Buffer | Blob | NodeJS.ReadableStream;
};

export type UploadTestResultsParams = {
  trs: TestResult[];
  attachmentsResolver: (tr: TestResult) => Promise<AttachmentForUpload[]>;
  fixturesResolver: (tr: TestResult) => Promise<unknown[]>;
  onProgress?: () => void;
};

export type TestopsUploaderOptions = {
  endpoint: string;
  accessToken: string;
  projectId: string;
  launchName: string;
  launchTags: string[];
  autocloseLaunch?: boolean;
  filter?: (testResult: TestResult) => boolean;
  limit?: number;
};

export type TemplateManifest = Record<string, string>;

export type TestopsPluginOptions = TestopsUploaderOptions;

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

export type TestResultWithAttachments = TestResult & {
  attachments: AttachmentLink[];
};

export type TestOpsNamedEnv = {
  id: number;
  name: string;
  externalId: string;
  jobRunId: number;
  launchId: number;
};
