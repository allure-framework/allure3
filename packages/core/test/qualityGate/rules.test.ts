import { type KnownTestFailure, TestResult, TestStatus } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";
import { maxFailuresRule, minTestsCountRule, successRateRule } from "../../src/qualityGate/rules.js";

const createTestResult = (id: string, status: TestStatus) =>
  ({
    id,
    name: `Test ${id}`,
    status,
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: "", metadata: {} },
  }) as TestResult;

describe("maxFailuresRule", () => {
  it("should pass when failures count is less than expected (without state)", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "passed"),
      createTestResult("3", "failed"),
    ];
    const expected = 2;
    const result = await maxFailuresRule.validate({
      trs: testResults,
      expected,
      knownIssues: [] as KnownTestFailure[],
      state: 0,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(1);
    expect(result.expected).toBe(expected);
  });

  // it("should fail when failures count is greater than expected (without state)", async () => {
  //   const testResults: TestResult[] = [
  //     createTestResult("1", "passed"),
  //     createTestResult("2", "failed"),
  //     createTestResult("3", "failed"),
  //   ];
  //   const expected = 1;
  //   const result = await maxFailuresRule.validate({
  //     trs: testResults,
  //     expected,
  //     knownIssues: [] as KnownTestFailure[],
  //     state: 0,
  //   });
  //
  //   expect(result.success).toBe(false);
  //   expect(result.actual).toBe(2);
  //   expect(result.expected).toBe(expected);
  // });
  //
  // it("should pass when failures count plus state is less than expected (with state)", async () => {
  //   const testResults: TestResult[] = [
  //     createTestResult("1", "passed"),
  //     createTestResult("2", "passed"),
  //     createTestResult("3", "failed"),
  //   ];
  //   const expected = 3;
  //   const result = await maxFailuresRule.validate({
  //     trs: testResults,
  //     expected,
  //     knownIssues: [] as KnownTestFailure[],
  //     state: 1,
  //   });
  //
  //   expect(result.success).toBe(true);
  //   expect(result.actual).toBe(1);
  //   expect(result.expected).toBe(expected);
  // });
  //
  // it("should fail when failures count plus state is greater than expected (with state)", async () => {
  //   const testResults: TestResult[] = [
  //     createTestResult("1", "passed"),
  //     createTestResult("2", "failed"),
  //     createTestResult("3", "failed"),
  //   ];
  //   const expected = 3;
  //   const result = await maxFailuresRule.validate({
  //     trs: testResults,
  //     expected,
  //     knownIssues: [] as KnownTestFailure[],
  //     state: 2,
  //   });
  //
  //   expect(result.success).toBe(false);
  //   expect(result.actual).toBe(2);
  //   expect(result.expected).toBe(expected);
  // });
  //
  // it("should filter out known issues", async () => {
  //   const testResults: TestResult[] = [
  //     createTestResult("1", "passed"),
  //     createTestResult("2", "failed", "known-issue-1"),
  //     createTestResult("3", "failed"),
  //   ];
  //   const expected = 1;
  //   const result = await maxFailuresRule.validate({
  //     trs: testResults,
  //     expected,
  //     knownIssues: [{ historyId: "known-issue-1" }] as KnownTestFailure[],
  //     state: 0,
  //   });
  //
  //   expect(result.success).toBe(true);
  //   expect(result.actual).toBe(1);
  //   expect(result.expected).toBe(expected);
  // });
});

// describe("minTestsCountRule", () => {
//   it("should pass when test count is greater than expected (without state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "passed"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 2;
//     const result = await minTestsCountRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0,
//     });
//
//     expect(result.success).toBe(true);
//     expect(result.actual).toBe(3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should fail when test count is less than expected (without state)", async () => {
//     const testResults: TestResult[] = [createTestResult("1", "passed")];
//     const expected = 2;
//     const result = await minTestsCountRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0,
//     });
//
//     expect(result.success).toBe(false);
//     expect(result.actual).toBe(1);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should pass when test count is greater than expected (with state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "passed"),
//       createTestResult("3", "passed"),
//     ];
//     const expected = 3;
//     const result = await minTestsCountRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 2,
//     });
//
//     expect(result.success).toBe(true);
//     expect(result.actual).toBe(3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should fail when test count is less than expected (with state)", async () => {
//     const testResults: TestResult[] = [createTestResult("1", "passed")];
//     const expected = 3;
//     const result = await minTestsCountRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 1,
//     });
//
//     expect(result.success).toBe(false);
//     expect(result.actual).toBe(1);
//     expect(result.expected).toBe(expected);
//   });
// });
//
// describe("successRateRule", () => {
//   it("should pass when success rate is greater than expected (without state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "passed"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 0.6;
//     const result = await successRateRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0,
//     });
//
//     expect(result.success).toBe(true);
//     expect(result.actual).toBe(2 / 3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should fail when success rate is less than expected (without state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "failed"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 0.6;
//     const result = await successRateRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0,
//     });
//
//     expect(result.success).toBe(false);
//     expect(result.actual).toBe(1 / 3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should pass when success rate is greater than expected (with state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "passed"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 0.6;
//     const result = await successRateRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0.1,
//     });
//
//     expect(result.success).toBe(true);
//     expect(result.actual).toBe(2 / 3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should fail when success rate is less than expected (with state)", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "failed"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 0.6;
//     const result = await successRateRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [] as KnownTestFailure[],
//       state: 0.2,
//     });
//
//     expect(result.success).toBe(false);
//     expect(result.actual).toBe(1 / 3);
//     expect(result.expected).toBe(expected);
//   });
//
//   it("should filter out known issues", async () => {
//     const testResults: TestResult[] = [
//       createTestResult("1", "passed"),
//       createTestResult("2", "failed", "known-issue-1"),
//       createTestResult("3", "failed"),
//     ];
//     const expected = 0.5;
//     const result = await successRateRule.validate({
//       trs: testResults,
//       expected,
//       knownIssues: [{ historyId: "known-issue-1" }] as KnownTestFailure[],
//       state: 0,
//     });
//
//     expect(result.success).toBe(true);
//     expect(result.actual).toBe(0.5);
//     expect(result.expected).toBe(expected);
//   });
// });
