/* eslint max-lines: 0 */
import type { RawTestStepResult } from "@allurereport/reader-api";
import { step } from "allure-js-commons";
import { existsSync, lstatSync } from "fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
  });
});
