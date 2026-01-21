import type { AttachmentLink, TestResult } from "@allurereport/core-api";

export type TestopsUploaderOptions = {
  reportName?: string;
  endpoint: string;
  accessToken: string;
  projectId: string;
};

export type TemplateManifest = Record<string, string>;

export type TestopsUploaderPluginOptions = TestopsUploaderOptions;

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
  tags: [];
  links: [];
  issues: [];
  createdDate: number;
  lastModifiedDate: number;
};

export type TestResultWithAttachments = TestResult & {
  attachments: AttachmentLink[];
};
