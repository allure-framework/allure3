/* eslint @typescript-eslint/unbound-method: 0, max-lines: 0 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { junitXml } from "../src/index.js";
import { mockVisitor, readResourceAsResultFile, readResults } from "./utils.js";

const randomTestsuiteFileName = () => `${randomUUID()}.xml`;

describe("junit xml reader", () => {
  describe("names", () => {
    it("should parse a testcase name", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/names/wellDefined.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ name: "foo" }]);
    });

    it("should use a placeholder if no name provided", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/names/missing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ name: "The test's name is not defined" }]);
    });

    it("should use a placeholder if the name is ill-formed", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/names/invalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ name: "The test's name is not defined" }]);
    });
  });

  describe("labels", () => {
    describe("suite", () => {
      it("should add a suite label from a suite name to a test case", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/wellDefinedWithOneTestCase.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: [{ name: "suite", value: "foo" }] }]);
      });

      it("should add a suite label from a suite name to all cases", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/wellDefinedWithTwoTestCases.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(2);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          { labels: [{ name: "suite", value: "foo" }] },
          { labels: [{ name: "suite", value: "foo" }] },
        ]);
      });

      it("should not add a suite label if no suite name defined", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/suiteNameMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "suite" }]) }]);
      });

      it("should not add a suite label if the suite name is ill-formed", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/suiteNameInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "suite" }]) }]);
      });

      // See https://github.com/windyroad/JUnit-Schema/blob/cfa434d4b8e102a8f55b8727b552a0063ee9044e/JUnit.xsd#L173
      it("should add package as parent suite for an aggregated document", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/wellDefinedAggregated.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.arrayContaining([{ name: "parentSuite", value: "foo" }]) }]);
      });

      it("should ignore a missing package of an aggregated document", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/aggregatedPackageMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "parentSuite" }]) }]);
      });

      it("should ignore an ill-formed package of an aggregated document", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/suites/aggregatedPackageInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "parentSuite" }]) }]);
      });
    });

    describe("testClass", () => {
      it("should add a testClass label if classname is defined for a test case", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/testClasses/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: [{ name: "testClass", value: "foo" }] }]);
      });

      it("should not add a testClass label if classname is missing", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/testClasses/missing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "testClass" }]) }]);
      });

      it("should not add a testClass label if classname is ill-formed", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/testClasses/invalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "testClass" }]) }]);
      });
    });

    // See https://github.com/windyroad/JUnit-Schema/blob/cfa434d4b8e102a8f55b8727b552a0063ee9044e/JUnit.xsd#L28C29-L28C36
    describe("package", () => {
      it("should add a package label to a test case", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/packages/wellDefinedWithOneTestCase.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: [{ name: "package", value: "foo" }] }]);
      });

      it("should add a package label to all cases", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/packages/wellDefinedWithTwoTestCases.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(2);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          { labels: [{ name: "package", value: "foo" }] },
          { labels: [{ name: "package", value: "foo" }] },
        ]);
      });

      it("should not add a label if no package defined", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/packages/suitePackageMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "package" }]) }]);
      });

      it("should not add a label if package is ill-formed", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/labels/packages/suitePackageInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ labels: expect.not.arrayContaining([{ name: "package" }]) }]);
      });
    });
  });

  describe("durations", () => {
    it("should convert a test case duration from seconds to milliseconds", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/durations/integer.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ duration: 4000 }]);
    });

    it("should round the duration up if it has 500 microseconds or more", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/durations/roundUp.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ duration: 1001 }]);
    });

    it("should round the duration down if it has less than 500 microseconds", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/durations/roundUp.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ duration: 1001 }]);
    });

    it("should ignore an ill-formed time attribute", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/durations/invalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs[0].duration).toBeUndefined();
    });
  });

  describe("fullNames", () => {
    it("should combine classname and name into a fullName", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/fullNames/wellDefined.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ fullName: "foo.bar" }]);
    });

    it("should leave fullName undefined if no classname defined", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/fullNames/classnameMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs[0].fullName).toBeUndefined();
    });

    it("should leave fullName undefined if classname is ill-formed", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/fullNames/classnameInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs[0].fullName).toBeUndefined();
    });

    it("should leave fullName undefined if no name defined", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/fullNames/nameMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs[0].fullName).toBeUndefined();
    });

    it("should leave fullName undefined if name is ill-formed", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/fullNames/nameInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs[0].fullName).toBeUndefined();
    });
  });

  describe("statuses", () => {
    it("should parse a test case with no status elements as passed", async () => {
      const visitor = await readResults(junitXml, {
        "junitxmldata/statuses/passed.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "passed" }]);
    });

    describe("failure", () => {
      it("should parse a failure element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/failure/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "failed", message: "foo", trace: "bar" }]);
      });

      it("should ignore a missing message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/failure/messageMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should ignore an ill-formed message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/failure/messageInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should leave trace undefined if content is missing", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/failure/contentMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].trace).toBeUndefined();
      });

      it("should parse an empty element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/failure/empty.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "failed" }]);
      });
    });

    describe("skipped", () => {
      it("should parse a skipped element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/skipped/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "skipped", message: "foo", trace: "bar" }]);
      });

      it("should ignore a missing message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/skipped/messageMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should ignore an ill-formed message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/skipped/messageInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should leave trace undefined if content is missing", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/skipped/contentMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].trace).toBeUndefined();
      });

      it("should parse an empty element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/skipped/empty.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "skipped" }]);
      });
    });

    describe("error", () => {
      it("should parse an error element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/error/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "broken", message: "foo", trace: "bar" }]);
      });

      it("should ignore a missing message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/error/messageMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should ignore an ill-formed message", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/error/messageInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].message).toBeUndefined();
      });

      it("should leave trace undefined if content is missing", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/error/contentMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs[0].trace).toBeUndefined();
      });

      it("should parse an empty element", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/statuses/error/empty.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([{ status: "broken" }]);
      });
    });
  });

  describe("attachments", () => {
    describe("stdout", () => {
      it("should parse system-out", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stdout/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const test = visitor.visitTestResult.mock.calls[0][0];
        const content = await attachment.asUtf8String();
        expect(content).toEqual("Lorem Ipsum");
        expect(test).toMatchObject({
          steps: [
            {
              type: "attachment",
              name: "System output",
              contentType: "text/plain",
              originalFileName: attachment.getOriginalFileName(),
            },
          ],
        });
      });

      it("should ignore a missing system-out", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stdout/missing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({ steps: [] });
      });

      it("should ignore an ill-formed system-out", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stdout/invalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({ steps: [] });
      });
    });

    describe("stderr", () => {
      it("should parse system-err", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stderr/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
        const attachment = visitor.visitAttachmentFile.mock.calls[0][0];
        const test = visitor.visitTestResult.mock.calls[0][0];
        const content = await attachment.asUtf8String();
        expect(content).toEqual("Lorem Ipsum");
        expect(test).toMatchObject({
          steps: [
            {
              type: "attachment",
              name: "System error",
              contentType: "text/plain",
              originalFileName: attachment.getOriginalFileName(),
            },
          ],
        });
      });

      it("should ignore a missing system-err", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stderr/missing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({ steps: [] });
      });

      it("should ignore an ill-formed system-err", async () => {
        const visitor = await readResults(junitXml, {
          "junitxmldata/attachments/stderr/invalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(0);
        const test = visitor.visitTestResult.mock.calls[0][0];
        expect(test).toMatchObject({ steps: [] });
      });
    });
  });

  it("should ignore invalid root element", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("junitxmldata/invalid.xml", randomTestsuiteFileName());
    const read = await junitXml.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should parse empty root element", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("junitxmldata/empty.xml", randomTestsuiteFileName());
    const read = await junitXml.read(visitor, resultFile);

    expect(read).toBeTruthy();
  });

  it("should parse test-suites element with invalid type", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("junitxmldata/wrong-type.xml", randomTestsuiteFileName());
    const read = await junitXml.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should parse single test with name and status", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/single.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: "shouldGenerate", status: "passed" })]),
    );
  });

  it("should parse single test with wrapping suites tag with name and status", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/single-suites.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: "shouldGenerate", status: "passed" })]),
    );
  });

  it("should parse sample tests with name and status", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/sample.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(2);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "test1", status: "passed" }),
        expect.objectContaining({ name: "test2", status: "passed" }),
      ]),
    );
  });

  it("should parse sample tests with wrapping suites tag with name and status", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/sample-suites.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(4);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "test1", status: "passed" }),
        expect.objectContaining({ name: "test2", status: "passed" }),
        expect.objectContaining({ name: "test3", status: "passed" }),
        expect.objectContaining({ name: "test4", status: "passed" }),
      ]),
    );
  });
});
