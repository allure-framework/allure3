import type { TestLabel, TestLink, TestParameter } from "./metadata.js";
import type { TestCase } from "./testCase.js";

export type TestStatus = "failed" | "broken" | "passed" | "skipped" | "unknown";
export type SeverityLevel = "blocker" | "critical" | "normal" | "minor" | "trivial";

/**
 * Stores source-specific metadata.
 */
export interface SourceMetadata {
  readerId: string;
  metadata: { [key: string]: any };
}

export interface TestError {
  message?: string;
  trace?: string;
  actual?: string;
  expected?: string;
}

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  error?: TestError;

  testCase?: TestCase;

  environment?: string;

  fullName?: string;
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

  flaky: boolean;
  new: boolean;
  muted: boolean;
  known: boolean;

  hidden: boolean;

  hostId?: string;
  threadId?: string;

  labels: TestLabel[];
  parameters: TestParameter[];
  links: TestLink[];

  steps: TestStepResult[];

  sourceMetadata: SourceMetadata;

  runSelector?: string;

  retries?: TestResult[];
  categories?: any;
}

export interface TestEnvGroup {
  id: string;
  name: string;
  fullName?: string;
  status: TestStatus;
  testResultsByEnv: Record<string, string>;
}

export interface TestFixtureResult {
  id: string;
  testResultIds: string[];
  type: "before" | "after";
  name: string;

  status: TestStatus;
  error?: TestError;

  start?: number;
  stop?: number;
  duration?: number;

  steps: TestStepResult[];

  sourceMetadata: SourceMetadata;
}

export type TestStepResult = DefaultTestStepResult | AttachmentTestStepResult;

export interface DefaultTestStepResult {
  name: string;
  parameters: TestParameter[];

  status: TestStatus;
  error?: TestError;

  start?: number;
  stop?: number;
  duration?: number;

  steps: TestStepResult[];
  stepId?: string;

  type: "step";

  message?: string;
  trace?: string;
  hasSimilarErrorInSubSteps?: boolean;
}

/**
 * ResultFile is marked as possible attachment, but not yet linked to the result.
 */
export interface AttachmentLinkFile {
  id: string;
  contentType?: string;
  contentLength?: number;
  originalFileName: string;
  ext: string;
  used: false;
  missed: false;
}

/**
 * TestResult or TestFixtureResult has a link to attachment file, but no such ResultFile is yet processed.
 */
export interface AttachmentLinkExpected {
  id: string;
  name: string;
  contentType?: string;
  originalFileName: string;
  ext: string;
  used: true;
  missed: true;
}

/**
 * TestResult or TestFixtureResult has a link to attachment and ResultFile with such originalFileName
 * is already indexed.
 */
export type AttachmentLinkLinked = Omit<AttachmentLinkFile, "used"> & Omit<AttachmentLinkExpected, "missed">;

/**
 * TestResult or TestFixtureResult has a link to attachment but with no originalFileName
 * specified, so we can't link it to any file.
 */
export type AttachmentLinkInvalid = Omit<AttachmentLinkExpected, "originalFileName" | "ext"> & {
  originalFileName: undefined;
  ext: "";
};

export type AttachmentLink = AttachmentLinkFile | AttachmentLinkExpected | AttachmentLinkLinked | AttachmentLinkInvalid;

export interface AttachmentTestStepResult {
  link: AttachmentLinkExpected | AttachmentLinkLinked | AttachmentLinkInvalid;
  type: "attachment";
}

export interface RepoData {
  name: string;
  branch: string;
}
