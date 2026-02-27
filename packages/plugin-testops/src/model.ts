import type { AttachmentLink, TestResult } from "@allurereport/core-api";

export type TestopsUploaderOptions = {
  endpoint: string;
  accessToken: string;
  projectId: string;
  launchName: string;
  launchTags: string[];
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
