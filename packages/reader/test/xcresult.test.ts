/* eslint max-lines: 0 */
import type { RawTestLabel, RawTestResult, RawTestStepResult } from "@allurereport/reader-api";
import { step } from "allure-js-commons";
import { existsSync, lstatSync } from "fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { IS_MAC } from "../src/xcresult/bundle.js";
import { readXcResultBundle } from "../src/xcresult/index.js";
import { attachResultDir, buildResourcePath, mockVisitor } from "./utils.js";

const filenamePatterns = {
  unnamed: /public\.data_\d_[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/,
  bar: /bar_\d_[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/,
};

const readXcResultResource = async (resourcePath: string, expectedResult: boolean = true) => {
  return await step("readXcResultBundle", async () => {
    const visitor = mockVisitor();

    const directory = buildResourcePath(path.join("xcresultdata", resourcePath));

    if (!existsSync(directory)) {
      throw new Error(`${directory} doesn't exist`);
    }

    if (!lstatSync(directory).isDirectory()) {
      throw new Error(`${directory} is not a directory`);
    }

    await attachResultDir(directory);

    const success = await readXcResultBundle(visitor, directory);
    expect(success).toEqual(expectedResult);

    return visitor;
  });
};

describe.skipIf(!IS_MAC)("on MAC", () => {
  describe("attachments", () => {
    it("should parse a nameless test attachment", async () => {
      const result = await readXcResultResource("attachments/nameless.xcresult");
      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);
      const attachments = result.visitAttachmentFile.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          steps: [
            {
              type: "attachment",
              name: "Attachment",
              originalFileName: expect.stringMatching(filenamePatterns.unnamed),
            },
          ],
        },
      ]);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].getOriginalFileName()).toMatch(filenamePatterns.unnamed);
      expect(await attachments[0].asUtf8String()).toMatch("Lorem Ipsum");
    });

    it("should parse two unnamed test attachments", async () => {
      const result = await readXcResultResource("attachments/twoUnnamed.xcresult");
      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);
      const attachments = result.visitAttachmentFile.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          steps: [
            {
              type: "attachment",
              name: "Attachment 1",
              originalFileName: expect.stringMatching(filenamePatterns.unnamed),
            },
            {
              type: "attachment",
              name: "Attachment 2",
              originalFileName: expect.stringMatching(filenamePatterns.unnamed),
            },
          ],
        },
      ]);
      expect(attachments).toHaveLength(2);
      expect(attachments[0].getOriginalFileName()).toMatch(filenamePatterns.unnamed);
      expect(attachments[1].getOriginalFileName()).toMatch(filenamePatterns.unnamed);
      expect(await attachments[0].asUtf8String()).toMatch("Lorem Ipsum 1");
      expect(await attachments[1].asUtf8String()).toMatch("Lorem Ipsum 2");
    });

    it("should parse a named test attachment", async () => {
      const result = await readXcResultResource("attachments/named.xcresult");
      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);
      const attachments = result.visitAttachmentFile.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          steps: [
            {
              type: "attachment",
              name: "bar",
              originalFileName: expect.stringMatching(filenamePatterns.bar),
            },
          ],
        },
      ]);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].getOriginalFileName()).toMatch(filenamePatterns.bar);
      expect(await attachments[0].asUtf8String()).toMatch("Lorem Ipsum");
    });

    it("should parse a test attachment with a known UTI", async () => {
      const result = await readXcResultResource("attachments/text.xcresult");
      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          steps: [
            {
              type: "attachment",
              contentType: "text/plain",
            },
          ],
        },
      ]);
    });
  });

  describe("outcomes", () => {
    it("should parse a passed test", async () => {
      const result = await readXcResultResource("outcomes/passed.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "passed",
        },
      ]);
    });

    it("should parse a test with one failed top-level assertion", async () => {
      const result = await readXcResultResource("outcomes/oneFailedAssertion.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "failed",
          message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/),
          steps: [
            {
              type: "step",
              name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
              status: "failed",
              message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
              ),
            },
          ],
        },
      ]);
    });

    it("should parse a test with multiple failed top-level assertions", async () => {
      const result = await readXcResultResource("outcomes/twoFailedAssertions.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "failed",
          message: '2 failures have occured. The first one is:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/),
          steps: [
            {
              type: "step",
              name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
              message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
              ),
              steps: [],
            },
            {
              type: "step",
              name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
              message: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
              ),
              steps: [],
            },
          ],
        },
      ]);
    });

    it("should parse a skipped test", async () => {
      const result = await readXcResultResource("outcomes/skipped.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "skipped",
          message: "Test skipped - Lorem Ipsum",
          trace: expect.stringMatching(/At .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/),
        },
      ]);
    });

    it("should parse a test with one top-level expected failure", async () => {
      const result = await readXcResultResource("outcomes/oneExpectedFailure.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "passed",
          message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/),
        },
      ]);
    });

    it("should parse a test with multiple top-level expected failures", async () => {
      const result = await readXcResultResource("outcomes/twoExpectedFailures.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "passed",
          message:
            '2 expected failures have occured. The first one is:\n  Lorem Ipsum:\n    XCTAssertEqual failed: ("1") is not equal to ("2")',
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/),
          steps: [
            {
              type: "step",
              name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
              message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
              ),
              steps: [],
            },
            {
              type: "step",
              name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
              message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("3") is not equal to ("4")',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8/,
              ),
              steps: [],
            },
          ],
        },
      ]);
    });

    it("should parse a test with an uncaught exception", async () => {
      const result = await readXcResultResource("outcomes/uncaughtException.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "broken",
          message: 'failed: caught error: "runtimeError("Lorem Ipsum")"',
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10/),
          steps: [
            {
              type: "step",
              name: 'failed: caught error: "runtimeError("Lorem Ipsum")"',
              status: "broken",
              message: 'failed: caught error: "runtimeError("Lorem Ipsum")"',
              trace: expect.stringMatching(
                /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10/,
              ),
            },
          ],
        },
      ]);
    });

    it("should parse a test with one violated top-level expected failure", async () => {
      const result = await readXcResultResource("outcomes/violatedExpectedFailure.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "failed",
          message: "Expected failure 'Lorem Ipsum' but none recorded",
          trace: expect.stringMatching(/foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/),
        },
      ]);
    });
  });

  describe("activities", () => {
    describe("outcomes", () => {
      it("should parse a passed activity", async () => {
        const result = await readXcResultResource("activities/onePassedActivity.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            steps: [
              {
                type: "step",
                name: "bar",
                status: "passed",
                steps: [],
              },
            ],
          },
        ]);
      });

      it("should parse an activity with one failed assertion", async () => {
        const result = await readXcResultResource("activities/oneActivityWithOneFailedAssertion.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "failed",
            message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
            trace: expect.stringMatching(
              /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
            ),
            steps: [
              {
                type: "step",
                name: "bar",
                status: "failed",
                message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                trace: expect.stringMatching(
                  /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                ),
                steps: [
                  {
                    type: "step",
                    name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    status: "failed",
                    message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                    ),
                    steps: [],
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("should parse an activity with multiple failed assertions", async () => {
        const result = await readXcResultResource("activities/oneActivityWithTwoFailedAssertions.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "failed",
            message: '2 failures have occured. The first one is:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
            trace: expect.stringMatching(
              /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
            ),
            steps: [
              {
                type: "step",
                name: "bar",
                status: "failed",
                message:
                  '2 failures have occured. The first one is:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                trace: expect.stringMatching(
                  /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                ),
                steps: [
                  {
                    type: "step",
                    status: "failed",
                    name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                    ),
                    steps: [],
                  },
                  {
                    type: "step",
                    status: "failed",
                    name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    message: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                    ),
                    steps: [],
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("should parse an activity with one expected failure", async () => {
        const result = await readXcResultResource("activities/oneActivityWithOneExpectedFailure.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "passed",
            message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
            trace: expect.stringMatching(
              /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
            ),
            steps: [
              {
                type: "step",
                name: "bar",
                status: "passed",
                message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                trace: expect.stringMatching(
                  /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
                ),
                steps: [
                  {
                    type: "step",
                    name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    status: "passed",
                    message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
                    ),
                    steps: [],
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("should parse an activity with two expected failures", async () => {
        const result = await readXcResultResource("activities/oneActivityWithTwoExpectedFailures.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "passed",
            message:
              '2 expected failures have occured. The first one is:\n  Lorem Ipsum:\n    XCTAssertEqual failed: ("1") is not equal to ("2")',
            trace: expect.stringMatching(
              /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
            ),
            steps: [
              {
                type: "step",
                name: "bar",
                status: "passed",
                message:
                  '2 expected failures have occured. The first one is:\n  Lorem Ipsum:\n    XCTAssertEqual failed: ("1") is not equal to ("2")',
                trace: expect.stringMatching(
                  /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
                ),
                steps: [
                  {
                    type: "step",
                    name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                    status: "passed",
                    message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
                    ),
                    steps: [],
                  },
                  {
                    type: "step",
                    name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    status: "passed",
                    message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("3") is not equal to ("4")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:9\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7/,
                    ),
                    steps: [],
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("should correctly aggregate failed assertions on different levels", async () => {
        const result = await readXcResultResource("activities/threeNestedFailedActivities.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "failed",
            message: '3 failures have occured. The first one is:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
            trace: expect.stringMatching(
              /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
            ),
            steps: [
              {
                type: "step",
                name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                status: "failed",
                message: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                trace: expect.stringMatching(
                  /foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                ),
                steps: [],
              },
              {
                type: "step",
                name: "1",
                status: "failed",
                message:
                  '2 failures have occured. The first one is:\n  XCTAssertEqual failed: ("3") is not equal to ("4")',
                trace: expect.stringMatching(
                  /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8/,
                ),
                steps: [
                  {
                    type: "step",
                    name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    status: "failed",
                    message: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    trace: expect.stringMatching(
                      /closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8/,
                    ),
                    steps: [],
                  },
                  {
                    type: "step",
                    name: "1.1",
                    status: "failed",
                    message: 'XCTAssertEqual failed: ("5") is not equal to ("6")',
                    trace: expect.stringMatching(
                      /closure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:14\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:12\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8/,
                    ),
                    steps: [
                      {
                        type: "step",
                        name: 'XCTAssertEqual failed: ("5") is not equal to ("6")',
                        status: "failed",
                        message: 'XCTAssertEqual failed: ("5") is not equal to ("6")',
                        trace: expect.stringMatching(
                          /closure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:14\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:12\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8/,
                        ),
                        steps: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("should prefer failures over expected failures", async () => {
        const result = await readXcResultResource(
          "activities/threeActivitiesWithExpectedAndUnexpectedFailures.xcresult",
        );

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            status: "failed",
            message:
              '2 failures have occured (1 expected). The first unexpected one is:\n  XCTAssertEqual failed: ("3") is not equal to ("4")',
            trace: expect.stringMatching(
              /closure #2 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:17\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:15\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
            ),
            steps: [
              {
                type: "step",
                name: "1",
                status: "failed",
                message:
                  '2 failures have occured (1 expected). The first unexpected one is:\n  XCTAssertEqual failed: ("3") is not equal to ("4")',
                trace: expect.stringMatching(
                  /closure #2 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:17\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:15\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                ),
                steps: [
                  {
                    type: "step",
                    name: "1.1",
                    status: "passed",
                    message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                    trace: expect.stringMatching(
                      /closure #1 in closure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10\nclosure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                    ),
                    steps: [
                      {
                        type: "step",
                        name: 'XCTAssertEqual failed: ("1") is not equal to ("2")',
                        status: "passed",
                        message: 'Lorem Ipsum:\n  XCTAssertEqual failed: ("1") is not equal to ("2")',
                        trace: expect.stringMatching(
                          /closure #1 in closure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:10\nclosure #1 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:8\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:7\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                        ),
                        steps: [],
                      },
                    ],
                  },
                  {
                    type: "step",
                    name: "1.2",
                    status: "failed",
                    message: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                    trace: expect.stringMatching(
                      /closure #2 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:17\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:15\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                    ),
                    steps: [
                      {
                        type: "step",
                        name: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                        status: "failed",
                        message: 'XCTAssertEqual failed: ("3") is not equal to ("4")',
                        trace: expect.stringMatching(
                          /closure #2 in closure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:17\nclosure #1 in foo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:15\nfoo\.test\(\) at .*xcresult-examples\/xcresult-examplesXCTests\/foo\.swift:6/,
                        ),
                        steps: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      });
    });

    it("should parse nested activities", async () => {
      const result = await readXcResultResource("activities/sixNestedActivities.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          status: "passed",
          steps: [
            {
              type: "step",
              name: "1",
              status: "passed",
              steps: [
                {
                  type: "step",
                  name: "1.1",
                  status: "passed",
                  steps: [],
                },
                {
                  type: "step",
                  name: "1.2",
                  status: "passed",
                  steps: [],
                },
              ],
            },
            {
              type: "step",
              name: "2",
              status: "passed",
              steps: [
                {
                  type: "step",
                  name: "2.1",
                  status: "passed",
                  steps: [],
                },
                {
                  type: "step",
                  name: "2.2",
                  status: "passed",
                  steps: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it("should set timing properties", async () => {
      const result = await readXcResultResource("activities/sixNestedActivities.xcresult");

      const [
        {
          duration,
          steps: [
            {
              start: step1Start,
              stop: step1Stop,
              steps: [{ start: step11Start, stop: step11Stop }, { start: step12Start, stop: step12Stop }] = [],
            },
            {
              start: step2Start,
              stop: step2Stop,
              steps: [{ start: step21Start, stop: step21Stop }, { start: step22Start, stop: step22Stop }] = [],
            },
          ] = [],
        },
      ] =
        (result.visitTestResult.mock.calls.map((t) => t[0]) as {
          duration?: number;
          steps?: { start?: number; stop?: number; steps?: RawTestStepResult[] }[];
        }[]) ?? [];

      const expectedTimestampSequence = [
        step1Start,
        step11Start,
        step11Stop,
        step12Start,
        step12Stop,
        step1Stop,
        step2Start,
        step21Start,
        step21Stop,
        step22Start,
        step22Stop,
        step2Stop,
      ];
      const actualTimestampSequence = [...expectedTimestampSequence];
      actualTimestampSequence.sort();

      expect(actualTimestampSequence).toEqual(expectedTimestampSequence);
      expect(duration).toBeGreaterThan(0);
    });

    describe("Allure API", () => {
      it("should support the Allure ID activity API", async () => {
        const result = await readXcResultResource("activities/allureApi/allureId.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "test()",
            labels: expect.arrayContaining([{ name: "ALLURE_ID", value: "1004" }]),
            steps: [],
          },
        ]);
      });

      it("should support the test name activity API", async () => {
        const result = await readXcResultResource("activities/allureApi/testName.xcresult");

        const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

        expect(testResults).toMatchObject([
          {
            name: "bar",
            steps: [],
          },
        ]);
      });

      describe("description", () => {
        it("should set the description", async () => {
          const result = await readXcResultResource("activities/allureApi/description/single.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              description: "Lorem Ipsum",
              steps: [],
            },
          ]);
        });

        it("should merge multiple descriptions", async () => {
          const result = await readXcResultResource("activities/allureApi/description/multiple.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              description: "Lorem Ipsum\n\nDolor Sit Amet",
              steps: [],
            },
          ]);
        });
      });

      describe("precondition", () => {
        it("should set the precondition", async () => {
          const result = await readXcResultResource("activities/allureApi/precondition/single.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              precondition: "Lorem Ipsum",
              steps: [],
            },
          ]);
        });

        it("should merge multiple preconditions", async () => {
          const result = await readXcResultResource("activities/allureApi/precondition/multiple.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              precondition: "Lorem Ipsum\n\nDolor Sit Amet",
              steps: [],
            },
          ]);
        });
      });

      describe("expectedResult", () => {
        it("should set the expected result", async () => {
          const result = await readXcResultResource("activities/allureApi/expectedResult/single.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              expectedResult: "Lorem Ipsum",
              steps: [],
            },
          ]);
        });

        it("should merge multiple expected results", async () => {
          const result = await readXcResultResource("activities/allureApi/expectedResult/multiple.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              expectedResult: "Lorem Ipsum\n\nDolor Sit Amet",
              steps: [],
            },
          ]);
        });
      });

      describe("flaky", () => {
        it("should support implicit flaky value", async () => {
          const result = await readXcResultResource("activities/allureApi/flaky/implicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              flaky: true,
              steps: [],
            },
          ]);
        });

        it("should support explicit flaky value", async () => {
          const result = await readXcResultResource("activities/allureApi/flaky/explicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              flaky: true,
              steps: [],
            },
          ]);
        });
      });

      describe("muted", () => {
        it("should support implicit muted value", async () => {
          const result = await readXcResultResource("activities/allureApi/muted/implicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              muted: true,
              steps: [],
            },
          ]);
        });

        it("should support explicit muted value", async () => {
          const result = await readXcResultResource("activities/allureApi/muted/explicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              muted: true,
              steps: [],
            },
          ]);
        });
      });

      describe("known", () => {
        it("should support implicit known value", async () => {
          const result = await readXcResultResource("activities/allureApi/known/implicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              known: true,
              steps: [],
            },
          ]);
        });

        it("should support explicit known value", async () => {
          const result = await readXcResultResource("activities/allureApi/known/explicit.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              known: true,
              steps: [],
            },
          ]);
        });
      });

      describe("label", () => {
        it("should add a label", async () => {
          const result = await readXcResultResource("activities/allureApi/label/single.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              labels: expect.arrayContaining([{ name: "foo", value: "Lorem Ipsum" }]),
              steps: [],
            },
          ]);
        });
      });

      describe("link", () => {
        it("should add a nameless link with no type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/noNameNoType.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: undefined, type: undefined }],
              steps: [],
            },
          ]);
        });

        it("should add a named link with no type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/namedNoType.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "foo", type: undefined }],
              steps: [],
            },
          ]);
        });

        it("should add a nameless link with a type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/noNameTyped.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: undefined, type: "foo" }],
              steps: [],
            },
          ]);
        });

        it("should add a named link with a type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/namedTyped.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "foo", type: "bar" }],
              steps: [],
            },
          ]);
        });

        it("should add a nameless issue", async () => {
          const result = await readXcResultResource("activities/allureApi/link/noNameIssue.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: undefined, type: "issue" }],
              steps: [],
            },
          ]);
        });

        it("should add a named issue", async () => {
          const result = await readXcResultResource("activities/allureApi/link/namedIssue.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "ISSUE-1", type: "issue" }],
              steps: [],
            },
          ]);
        });

        it("should add a nameless tms link", async () => {
          const result = await readXcResultResource("activities/allureApi/link/noNameTms.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: undefined, type: "tms" }],
              steps: [],
            },
          ]);
        });

        it("should add a named tms link", async () => {
          const result = await readXcResultResource("activities/allureApi/link/namedTms.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "TMS-1", type: "tms" }],
              steps: [],
            },
          ]);
        });

        it("should decode a url name", async () => {
          const result = await readXcResultResource("activities/allureApi/link/encodedName.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "foo.bar[baz]", type: undefined }],
              steps: [],
            },
          ]);
        });

        it("should decode a type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/encodedType.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: undefined, type: "foo.bar[baz]" }],
              steps: [],
            },
          ]);
        });

        it("should decode a name and a type", async () => {
          const result = await readXcResultResource("activities/allureApi/link/encodedNameAndType.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              links: [{ url: "https://allurereport.org", name: "foo.bar[baz]", type: "qux.qox[zte]" }],
              steps: [],
            },
          ]);
        });
      });

      describe("parameter", () => {
        it("should add a parameter", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/plain.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                { name: "foo", value: "bar", exclude: undefined, hidden: undefined, masked: undefined },
              ]),
              steps: [],
            },
          ]);
        });

        it("should add an excluded parameter", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/excluded.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                { name: "foo", value: "bar", excluded: true, hidden: undefined, masked: undefined },
              ]),
              steps: [],
            },
          ]);
        });

        it("should add a masked parameter", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/masked.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                { name: "foo", value: "bar", excluded: undefined, hidden: undefined, masked: true },
              ]),
              steps: [],
            },
          ]);
        });

        it("should add an excluded hidden parameter", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/excludedHidden.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                { name: "foo", value: "bar", excluded: true, hidden: true, masked: undefined },
              ]),
              steps: [],
            },
          ]);
        });

        it("should add a hidden parameter", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/hidden.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                { name: "foo", value: "bar", excluded: undefined, hidden: true, masked: undefined },
              ]),
              steps: [],
            },
          ]);
        });

        it("should decode a name", async () => {
          const result = await readXcResultResource("activities/allureApi/parameter/encodedName.xcresult");

          const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

          expect(testResults).toMatchObject([
            {
              name: "test()",
              parameters: expect.arrayContaining([
                {
                  name: "foo.bar[baz]:qux",
                  value: "Lorem Ipsum",
                  excluded: undefined,
                  hidden: undefined,
                  masked: undefined,
                },
              ]),
              steps: [],
            },
          ]);
        });
      });
    });
  });

  describe("repetitions", () => {
    it("should add repetition parameter", async () => {
      const result = await readXcResultResource("twoRepetitions.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          parameters: expect.arrayContaining([{ name: "Repetition", value: "Repetition 1 of 2", excluded: true }]),
        },
        {
          name: "test()",
          parameters: expect.arrayContaining([{ name: "Repetition", value: "Repetition 2 of 2", excluded: true }]),
        },
      ]);
    });
  });

  // TODO: revisit after we implement ENVS properly
  describe("destinations", () => {
    it("should add the ENV discriminator", async () => {
      const result = await readXcResultResource("outcomes/passed.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          parameters: expect.arrayContaining([
            { name: "Device", value: "My Mac", excluded: undefined, hidden: undefined, masked: undefined },
          ]),
        },
      ]);
      expect(testResults).toMatchObject([
        {
          parameters: expect.not.arrayContaining([expect.objectContaining({ name: "Device Details" })]),
        },
      ]);
    });

    it("should add the ENV details if more than one device", async () => {
      const result = await readXcResultResource("devices/twoDevices.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toMatchObject([
        {
          name: "test()",
          parameters: expect.arrayContaining([
            { name: "Device", value: "My Mac", excluded: undefined, hidden: undefined, masked: undefined },
            {
              name: "Device Details",
              value: "MacBook Air, arm64, macOS 15.3.1",
              excluded: true,
              hidden: undefined,
              masked: undefined,
            },
          ]),
        },
        {
          name: "test()",
          parameters: expect.arrayContaining([
            { name: "Device", value: "iPhone 16", excluded: undefined, hidden: undefined, masked: undefined },
            {
              name: "Device Details",
              value: "iPhone 16, arm64, iOS Simulator 18.2",
              excluded: true,
              hidden: undefined,
              masked: undefined,
            },
          ]),
        },
      ]);
    });

    describe("iOS simulator", () => {
      let testResult: RawTestResult | undefined;

      beforeAll(async () => {
        const result = await readXcResultResource("devices/iphone16.xcresult");
        [testResult] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should set the host label from the OS simulator host machine", async () => {
        expect(testResult).toMatchObject({
          name: "test()",
          parameters: expect.arrayContaining([
            { name: "Device", value: "iPhone 16", excluded: undefined, hidden: undefined, masked: undefined },
          ]),
          labels: expect.arrayContaining([{ name: "host", value: "My Mac" }]),
        });
      });
    });
  });

  describe("labels", () => {
    describe("a test with no suites", () => {
      let labels: RawTestLabel[] | undefined = [];
      beforeAll(async () => {
        const result = await readXcResultResource("suites/noSuites.xcresult");
        [{ labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should set package to project and bundle", () => {
        expect(labels).toContainEqual({ name: "package", value: "xcresult-examples.xcresult-examplesTests" });
      });

      it("should set host", () => {
        expect(labels).toContainEqual({ name: "host", value: "My Mac" });
      });

      it("should set testMethod", () => {
        expect(labels).toContainEqual({ name: "testMethod", value: "test()" });
      });

      it("should set parentSuite to bundle", () => {
        expect(labels).toContainEqual({ name: "parentSuite", value: "xcresult-examplesTests" });
      });

      it("should not have suite", () => {
        expect(labels).not.toContainEqual(expect.objectContaining({ name: "suite" }));
      });

      it("should not have subSuite", () => {
        expect(labels).not.toContainEqual(expect.objectContaining({ name: "subSuite" }));
      });

      it("should not have testClass", () => {
        expect(labels).not.toContainEqual(expect.objectContaining({ name: "testClass" }));
      });
    });

    describe("a test with a suite", () => {
      let labels: RawTestLabel[] | undefined = [];
      beforeAll(async () => {
        const result = await readXcResultResource("suites/oneSuite.xcresult");
        [{ labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should have a suite", () => {
        expect(labels).toContainEqual({ name: "suite", value: "Foo" });
      });

      it("should have a testClass", () => {
        expect(labels).toContainEqual({ name: "testClass", value: "Foo" });
      });

      it("should not have a subSuite", () => {
        expect(labels).not.toContainEqual(expect.objectContaining({ name: "subSuite" }));
      });
    });

    describe("a test nested within two suites", () => {
      let labels: RawTestLabel[] | undefined = [];
      beforeAll(async () => {
        const result = await readXcResultResource("suites/twoSuites.xcresult");
        [{ labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should have a suite", () => {
        expect(labels).toContainEqual({ name: "suite", value: "Foo" });
      });

      it("should have a subSuite", () => {
        expect(labels).toContainEqual({ name: "subSuite", value: "Bar" });
      });

      it("should join both suites to form a testClass", () => {
        expect(labels).toContainEqual({ name: "testClass", value: "Foo.Bar" });
      });
    });

    describe("a test nested within three suites", () => {
      let labels: RawTestLabel[] | undefined = [];
      beforeAll(async () => {
        const result = await readXcResultResource("suites/threeSuites.xcresult");
        [{ labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should have two suites merged into subSuite", () => {
        expect(labels).toContainEqual({ name: "subSuite", value: "Bar > Baz" });
      });

      it("should join all three suites to form a testClass", () => {
        expect(labels).toContainEqual({ name: "testClass", value: "Foo.Bar.Baz" });
      });
    });

    describe("named suites and test", () => {
      let labels: RawTestLabel[] | undefined = [];
      beforeAll(async () => {
        const result = await readXcResultResource("suites/threeNamedSuites.xcresult");
        [{ labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);
      });

      it("should use the explicit name for suite", () => {
        expect(labels).toContainEqual({ name: "suite", value: "Suite 1" });
      });

      it("should use the explicit name for subSuite", () => {
        expect(labels).toContainEqual({ name: "subSuite", value: "Suite 2 > Suite 3" });
      });

      it("should use original suite identifiers for testClass", () => {
        expect(labels).toContainEqual({ name: "testClass", value: "Foo.Bar.Baz" });
      });
    });
  });

  describe("named test", () => {
    let testResult: RawTestResult | undefined;
    beforeAll(async () => {
      const result = await readXcResultResource("namedTest.xcresult");
      [testResult] = result.visitTestResult.mock.calls.map((t) => t[0]);
    });

    it("should use explicit name as the title", async () => {
      expect(testResult).toMatchObject({ name: "Test" });
    });

    it("should use the original function name as the testMethod label", async () => {
      expect(testResult).toMatchObject({ labels: expect.arrayContaining([{ name: "testMethod", value: "test()" }]) });
    });

    it("should use the original function name in fullName", async () => {
      expect(testResult).toMatchObject({
        fullName: "test://com.apple.xcode/xcresult-examples/xcresult-examplesTests/test()",
      });
    });
  });

  describe("bug links", () => {
    it("should add a link from a bug with URL", async () => {
      const result = await readXcResultResource("bugs/urlOnly.xcresult");

      const [{ links }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(links).toMatchObject([{ url: "https://allurereport.org", name: undefined, type: "issue" }]);
    });

    it("should add a link from a bug with URL and name", async () => {
      const result = await readXcResultResource("bugs/urlAndName.xcresult");

      const [{ links }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(links).toMatchObject([{ url: "https://allurereport.org", name: "ISSUE-1", type: "issue" }]);
    });

    it("should ignore ID if URL and name are set", async () => {
      const result = await readXcResultResource("bugs/urlNameAndId.xcresult");

      const [{ links }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(links).toMatchObject([{ url: "https://allurereport.org", name: "ISSUE-1", type: "issue" }]);
    });

    it("should set the link's name if ID is set and the name don't", async () => {
      const result = await readXcResultResource("bugs/urlAndId.xcresult");

      const [{ links }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(links).toMatchObject([{ url: "https://allurereport.org", name: "Issue 1", type: "issue" }]);
    });

    it("should set the link's URL to ID if URL is missing", async () => {
      const result = await readXcResultResource("bugs/idOnly.xcresult");

      const [{ links }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(links).toMatchObject([{ url: "1", name: "Issue 1", type: "issue" }]);
    });
  });

  describe("parameters", () => {
    it("should support parameters", async () => {
      const result = await readXcResultResource("parameters/twoParameters.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toHaveLength(4);
      expect(testResults).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            name: "test(arg1:arg2:)",
            parameters: expect.arrayContaining([
              { name: "arg1", value: '"foo"' },
              { name: "arg2", value: "1" },
            ]),
          }),
          expect.objectContaining({
            name: "test(arg1:arg2:)",
            parameters: expect.arrayContaining([
              { name: "arg1", value: '"foo"' },
              { name: "arg2", value: "2" },
            ]),
          }),
          expect.objectContaining({
            name: "test(arg1:arg2:)",
            parameters: expect.arrayContaining([
              { name: "arg1", value: '"bar"' },
              { name: "arg2", value: "1" },
            ]),
          }),
          expect.objectContaining({
            name: "test(arg1:arg2:)",
            parameters: expect.arrayContaining([
              { name: "arg1", value: '"bar"' },
              { name: "arg2", value: "2" },
            ]),
          }),
        ]),
      );
    });

    it("should use parameter names if labels are specified", async () => {
      const result = await readXcResultResource("parameters/withLabel.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toHaveLength(2);
      expect(testResults).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            name: "test(argLbl:)",
            parameters: expect.arrayContaining([{ name: "arg", value: '"foo"' }]),
          }),
          expect.objectContaining({
            name: "test(argLbl:)",
            parameters: expect.arrayContaining([{ name: "arg", value: '"bar"' }]),
          }),
        ]),
      );
    });
  });

  describe("multiple test plans", () => {
    it("should add a parameter to report the test plan", async () => {
      const result = await readXcResultResource("twoTestPlans.xcresult");

      const testResults = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(testResults).toHaveLength(2);
      expect(testResults).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            name: "test()",
            parameters: expect.arrayContaining([{ name: "Test Plan", value: "xcresult-examples", excluded: true }]),
          }),
          expect.objectContaining({
            name: "test()",
            parameters: expect.arrayContaining([{ name: "Test Plan", value: "xcresult-examples2", excluded: true }]),
          }),
        ]),
      );
    });
  });

  describe("a UI test with messy summary groups", () => {
    it("should ignore groups not in the test's URI", async () => {
      const result = await readXcResultResource("selectedTestsGroup.xcresult");

      const [{ fullName, labels }] = result.visitTestResult.mock.calls.map((t) => t[0]);

      expect(fullName).toEqual(
        "test://com.apple.xcode/xcresult-examples/xcresult-examplesUITests/xcresult_examplesUITests/testExample",
      );
      // This UI test bundle contains an extra summary group 'Selected tests', which is missing in the source code.
      // The reader should ignore it
      expect(labels).not.toContain({ value: expect.stringContaining("Selected tests") });
      expect(labels).not.toContain({ name: "subSuite" });
      expect(labels).toEqual(
        expect.arrayContaining([
          { name: "parentSuite", value: "xcresult-examplesUITests" },
          { name: "suite", value: "xcresult_examplesUITests" },
          { name: "package", value: "xcresult-examples.xcresult-examplesUITests" },
        ]),
      );
    });
  });
});
