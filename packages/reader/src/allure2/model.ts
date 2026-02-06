export interface Attachment {
  name?: string;
  type?: string;
  source?: string;
}

// TODO we need to ensure case insensitive enums mapping + do not fail in case of invalid values

export enum Status {
  FAILED = "failed",
  BROKEN = "broken",
  PASSED = "passed",
  SKIPPED = "skipped",
}

export enum Stage {
  SCHEDULED = "scheduled",
  RUNNING = "running",
  FINISHED = "finished",
  PENDING = "pending",
  INTERRUPTED = "interrupted",
}

export enum ParameterMode {
  HIDDEN = "hidden",
  MASKED = "masked",
  DEFAULT = "default",
}

export interface Label {
  name?: string;
  value?: string;
}

export interface Link {
  name?: string;
  url?: string;
  type?: string;
}

export interface Parameter {
  name?: string;
  value?: string;
  excluded?: boolean;
  mode?: ParameterMode;
}

export interface StatusDetails {
  message?: string;
  trace?: string;
  known?: boolean;
  muted?: boolean;
  flaky?: boolean;
  actual?: string;
  expected?: string;
}

interface ExecutableItem {
  name?: string;
  status?: Status;
  statusDetails?: StatusDetails;
  stage?: Stage;
  description?: string;
  descriptionHtml?: string;
  steps?: StepResult[];
  attachments?: Attachment[];
  parameters?: Parameter[];
  start?: number;
  stop?: number;
}

export type FixtureResult = ExecutableItem;
export type StepResult = ExecutableItem;

export interface TestResult extends ExecutableItem {
  uuid?: string;
  historyId?: string;
  fullName?: string;
  testCaseId?: string;
  labels?: Label[];
  links?: Link[];
  titlePath?: string[];
}

export interface TestResultContainer {
  uuid?: string;
  name?: string;
  children?: string[];
  befores?: FixtureResult[];
  afters?: FixtureResult[];
}

export interface Globals {
  attachments: Attachment[];
  errors: StatusDetails[];
}
