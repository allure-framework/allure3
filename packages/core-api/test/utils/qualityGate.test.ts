import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { normalizeQualityGateResult, normalizeQualityGateResults } from "../../src/utils/qualityGate.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("qualityGate");
  await label("coverage", "report-data-model");
});

describe("normalizeQualityGateResult", () => {
  it("should preserve a current quality gate result", () => {
    const result = {
      status: "failed",
      key: "lint",
      environment: "Linux",
      tags: ["ci", "lint"],
      source: { type: "command", command: "npm run lint" },
      details: {
        message: "Lint failed",
        expected: 0,
        actual: 2,
        testResults: ["test-1"],
        stdout: "checking",
        stderr: "lint failed",
      },
    };

    expect(normalizeQualityGateResult(result)).toEqual(result);
  });

  it("should reject command results without a command", () => {
    expect(
      normalizeQualityGateResult({
        status: "failed",
        key: "lint",
        source: { type: "command" },
      }),
    ).toBeUndefined();
  });

  it("should convert legacy rule and check results", () => {
    expect(
      normalizeQualityGateResults([
        {
          success: false,
          rule: "maxFailures",
          message: "Too many failures",
          expected: 0,
          actual: 1,
          testResults: ["test-1", 2],
        },
        {
          id: "check-id",
          name: "Lint",
          status: "passed",
          tags: ["ci", "lint"],
          details: { command: "npm run lint", message: "lint ok", error: "warning" },
        },
      ]),
    ).toEqual([
      {
        status: "failed",
        key: "maxFailures",
        source: { type: "rule" },
        details: {
          message: "Too many failures",
          expected: 0,
          actual: 1,
          testResults: ["test-1"],
        },
      },
      {
        status: "passed",
        key: "Lint",
        tags: ["ci", "lint"],
        source: { type: "command", command: "npm run lint" },
        details: { stdout: "lint ok", stderr: "warning" },
      },
    ]);
  });

  it("should use a supplied key only for a legacy check result", () => {
    expect(normalizeQualityGateResult({ status: "passed", details: {} }, { legacyCheckFallbackKey: "legacy" })).toEqual(
      {
        status: "passed",
        key: "legacy",
        source: { type: "manual" },
      },
    );
    expect(normalizeQualityGateResult({ status: "passed", source: { type: "manual" } })).toBeUndefined();
  });

  it("should preserve a legacy manual check error as stderr", () => {
    expect(
      normalizeQualityGateResult({
        name: "Approval",
        status: "failed",
        details: { command: "", message: "Rejected", error: "Approval service unavailable" },
      }),
    ).toEqual({
      status: "failed",
      key: "Approval",
      source: { type: "manual" },
      details: {
        message: "Rejected",
        stderr: "Approval service unavailable",
      },
    });
  });
});
