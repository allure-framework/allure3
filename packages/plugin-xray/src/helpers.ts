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
const EXACT_ISSUE_KEY_PATTERN = new RegExp(`^${ISSUE_KEY_PATTERN.source}$`);

export const isXrayStatus = (value: string): value is XrayStatus =>
  (XRAY_STATUSES as readonly string[]).includes(value);

export const splitList = (value: string): string[] => uniq(value.split(","));

export const uniq = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/**
 * Escape characters that would break a Jira wiki markup link
 */
export const escapeWikiLinkText = (text: string): string => text.replace(/[\\[\]|]/g, "\\$&");

/**
 * Jira key of a Test is taken from the tms link name (same as in Allure 2),
 * falling back to the key found in the link url when the name is not a key
 */
export const getTestKey = (link: TestLink): string | undefined => {
  if (link.type !== "tms") {
    return undefined;
  }
  const name = link.name?.trim();
  return name && EXACT_ISSUE_KEY_PATTERN.test(name) ? name : link.url.match(ISSUE_KEY_PATTERN)?.[0];
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
