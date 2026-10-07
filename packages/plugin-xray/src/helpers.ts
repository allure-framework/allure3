import type { TestLink, TestResult, TestStatus } from "@allurereport/core-api";

import type { XrayStatus } from "./types.js";

export const XRAY_STATUSES: readonly XrayStatus[] = ["PASS", "FAIL", "TODO"];

export const DEFAULT_STATUSES: Readonly<Record<TestStatus, XrayStatus>> = {
  passed: "PASS",
  failed: "FAIL",
  broken: "FAIL",
  skipped: "TODO",
  unknown: "TODO",
};

const ISSUE_KEY_PATTERN = /[A-Z][A-Z0-9_]*-\d+/;

export const isXrayStatus = (value: string): value is XrayStatus =>
  (XRAY_STATUSES as readonly string[]).includes(value);

export const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Jira key of a Test is taken from the tms link name (same as in Allure 2),
 * falling back to the last segment of the link url
 */
export const getTestKey = (link: TestLink): string | undefined => {
  if (link.type !== "tms") {
    return undefined;
  }
  return link.name?.trim() || link.url.match(ISSUE_KEY_PATTERN)?.[0];
};

/**
 * FAIL beats everything, PASS beats TODO, TODO is the weakest
 */
export const mergeStatus = (current: XrayStatus | undefined, next: XrayStatus): XrayStatus => {
  if (current === "FAIL" || next === "FAIL") {
    return "FAIL";
  }
  if (current === "PASS" || next === "PASS") {
    return "PASS";
  }
  return "TODO";
};

export const collectStatuses = (
  results: TestResult[],
  statuses: Readonly<Record<TestStatus, XrayStatus>>,
): Map<string, XrayStatus> => {
  const result = new Map<string, XrayStatus>();

  for (const tr of results) {
    for (const link of tr.links) {
      const key = getTestKey(link);
      if (key) {
        result.set(key, mergeStatus(result.get(key), statuses[tr.status]));
      }
    }
  }

  return result;
};
