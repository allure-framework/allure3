import type { TestStatus } from "./model.js";

export interface Location {}

export interface TestLabel {
  name: string;
  value?: string;
}

export interface TestLink {
  name?: string;
  url: string;
  type?: string;
}

export interface TestParameter {
  name: string;
  value: string;
  hidden: boolean;
  excluded: boolean;
  masked: boolean;
}

// TODO issue link etc
export interface TestError {
  id: string;
  message: string;
  trace?: string;
  status?: TestStatus;
  code?: string;
  location?: Location;

  tags: string[];
  // passed status and non-empty message means expected?
  expected?: boolean;
}
