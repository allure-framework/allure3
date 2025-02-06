import type { XcTestResult } from "./xcresulttool/model.js";

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
  args?: ({ name: string; value: string } | undefined)[];
};
