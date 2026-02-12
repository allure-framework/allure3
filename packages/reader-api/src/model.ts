export type RawTestStatus = "failed" | "broken" | "passed" | "skipped" | "unknown";

export type RawMetadata = { [key: string]: any };

export type RawError = {
  message?: string;
  trace?: string;
  expected?: string;
  actual?: string;
};

export interface RawFixtureResult {
  uuid?: string;
  testResults?: string[];
  type: "before" | "after";

  name?: string;

  start?: number;
  stop?: number;
  duration?: number;

  status?: RawTestStatus;
  message?: string;
  trace?: string;
  expected?: string;
  actual?: string;

  steps?: RawStep[];
  titlePath?: string[];
}

export interface RawTestResult extends RawError {
  uuid?: string;
  name?: string;
  status?: RawTestStatus;

  fullName?: string;
  testId?: string;
  testCaseName?: string;
  historyId?: string;

  description?: string;
  descriptionHtml?: string;
  precondition?: string;
  preconditionHtml?: string;
  expectedResult?: string;
  expectedResultHtml?: string;

  start?: number;
  stop?: number;
  duration?: number;

  flaky?: boolean;
  muted?: boolean;
  known?: boolean;

  hostId?: string;
  threadId?: string;

  parameters?: RawTestParameter[];

  steps?: RawStep[];

  labels?: RawTestLabel[];
  links?: RawTestLink[];
  titlePath?: string[];
}

export interface RawTestLabel {
  name?: string;
  value?: string;
}

export interface RawTestLink {
  name?: string;
  url?: string;
  type?: string;
}

export interface RawTestParameter {
  name?: string;
  value?: string;
  hidden?: boolean;
  excluded?: boolean;
  masked?: boolean;
}

export type RawStep = RawTestStepResult | RawTestAttachment;

export interface RawTestStepResult {
  name?: string;

  status?: RawTestStatus;
  message?: string;
  trace?: string;
  actual?: string;
  expected?: string;

  start?: number;
  stop?: number;
  duration?: number;

  parameters?: RawTestParameter[];
  steps?: RawStep[];
  type: "step";
}

export interface RawTestAttachment {
  name?: string;
  originalFileName?: string;
  contentType?: string;
  contentLength?: number;

  optional?: boolean;

  start?: number;
  stop?: number;
  duration?: number;
  type: "attachment";
}

export interface RawGlobals {
  attachments: RawTestAttachment[];
  errors: RawError[];
}
