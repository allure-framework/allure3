/* eslint @typescript-eslint/unbound-method: 0, max-lines: 0 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allure1 } from "../src/index.js";
import { mockVisitor, readResourceAsResultFile, readResults } from "./utils.js";

const randomTestsuiteFileName = () => `${randomUUID()}-testsuite.xml`;

describe("allure1 reader", () => {
  it("should parse empty xml file", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("allure1data/empty-file.xml", randomTestsuiteFileName());
    const read = await allure1.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should parse empty xml correct xml heading", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("allure1data/empty-xml.xml", randomTestsuiteFileName());
    const read = await allure1.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should parse empty root element", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("allure1data/empty-root.xml", randomTestsuiteFileName());
    const read = await allure1.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should parse test-suites element with invalid type", async () => {
    const visitor = mockVisitor();
    const resultFile = await readResourceAsResultFile("allure1data/invalid-root.xml", randomTestsuiteFileName());
    const read = await allure1.read(visitor, resultFile);

    expect(read).toBeFalsy();
  });

  it("should process xml with invalid xml characters", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/bad-xml-characters.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: "привет! test1", status: "passed" })]),
    );
  });

  it("should parse root element without namespace", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/without-namespace.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(4);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "testOne", status: "passed" }),
        expect.objectContaining({ name: "testTwo", status: "passed" }),
        expect.objectContaining({ name: "testThree", status: "passed" }),
        expect.objectContaining({ name: "testFour", status: "passed" }),
      ]),
    );
  });

  it("should parse name and status", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/sample-testsuite.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(4);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "testOne", status: "passed" }),
        expect.objectContaining({ name: "testTwo", status: "passed" }),
        expect.objectContaining({ name: "testThree", status: "passed" }),
        expect.objectContaining({ name: "testFour", status: "passed" }),
      ]),
    );
  });

  it("should parse file with single test case", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/single.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(expect.arrayContaining([expect.objectContaining({ name: "testOne", status: "passed" })]));
  });

  describe("fullName", () => {
    it("should use the test case's labels", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/allProperties.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "test-class.test-method",
          labels: [
            { name: "testClass", value: "test-class" },
            { name: "testMethod", value: "test-method" },
          ],
        },
      ]);
    });

    it("should use the suite's class label if no test's class defined", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noTestClass.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "suite-class.test-method",
          labels: [
            { name: "testClass", value: "suite-class" },
            { name: "testMethod", value: "test-method" },
          ],
        },
      ]);
    });

    it("should use the suite's name if no class label defined", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noClassLabels.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "suite-name.test-method",
          labels: [
            { name: "testClass", value: "suite-name" },
            { name: "testMethod", value: "test-method" },
          ],
        },
      ]);
    });

    it("should use the suite's title if no name defined", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noSuiteName.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "suite-title.test-method",
          labels: [
            { name: "testClass", value: "suite-title" },
            { name: "testMethod", value: "test-method" },
          ],
        },
      ]);
    });

    it("should not set fullName if no suite part exists", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noSuitePart.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: undefined,
          labels: [{ name: "testMethod", value: "test-method" }],
        },
      ]);
    });

    it("should use the test case's name if no testMethod label defined for the test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noTestMethodLabel.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "test-class.test-name",
          labels: [
            { name: "testClass", value: "test-class" },
            { name: "testMethod", value: "test-name" },
          ],
        },
      ]);
    });

    it("should use the test case's title if no name defined", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noTestName.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: "test-class.test-title",
          labels: [
            { name: "testClass", value: "test-class" },
            { name: "testMethod", value: "test-title" },
          ],
        },
      ]);
    });

    it("should not set fullName if no test case component defined", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/fullNames/noTestPart.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          fullName: undefined,
          labels: [{ name: "testClass", value: "test-class" }],
        },
      ]);
    });
  });

  describe("failures", () => {
    it("should parse message and trace", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/wellDefined.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: "foo",
          trace: "bar",
        },
      ]);
    });

    it("should handle a missing message", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/messageMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: undefined,
          trace: "foo",
        },
      ]);
    });

    it("should handle an ill-formed message", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/messageInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: undefined,
          trace: "foo",
        },
      ]);
    });

    it("should handle a missing trace", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/traceMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: "foo",
          trace: undefined,
        },
      ]);
    });

    it("should handle an ill-formed trace", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/traceInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: "foo",
          trace: undefined,
        },
      ]);
    });

    it("should ignore an ill-formed failure", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/failures/elementInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          message: undefined,
          trace: undefined,
        },
      ]);
    });
  });

  describe("descriptions", () => {
    it("should parse a test case markdown description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/markdown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should parse a test case text description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/text.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should parse a test case HTML description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/html.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toBeUndefined();
      expect(tr.descriptionHtml).toEqual("Lorem Ipsum");
    });

    it("should parse a test suite markdown description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/suiteMarkdown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should parse a test suite text description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/suiteText.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should parse a test suite HTML description", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/suiteHtml.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toBeUndefined();
      expect(tr.descriptionHtml).toEqual("Lorem Ipsum");
    });

    it("should not set properties if both descriptions are missing", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/noDescriptions.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toBeUndefined();
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should combine suite and test markdown descriptions", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/markdownMarkdown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum\n\nDolor Sit Amet");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should combine suite and test HTML descriptions", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/htmlHtml.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toBeUndefined();
      expect(tr.descriptionHtml).toEqual("Lorem Ipsum<br>Dolor Sit Amet");
    });

    it("should combine markdown suite and HTML test descriptions", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/markdownHtml.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toEqual("Dolor Sit Amet");
    });

    it("should combine text suite and HTML test descriptions", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/textHtml.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toEqual("Dolor Sit Amet");
    });

    it("should combine text suite test descriptions", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/textText.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum\n\nDolor Sit Amet");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should ignore type case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/typeUpperCase.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.descriptionHtml).toEqual("Lorem Ipsum");
    });

    it("should ignore a missing value", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/valueMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toBeUndefined();
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should treat missing type as markdown", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/typeMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should treat an ill-formed type as markdown", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/typeInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });

    it("should treat an unknown type as markdown", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/descriptions/typeUnknown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.description).toEqual("Lorem Ipsum");
      expect(tr.descriptionHtml).toBeUndefined();
    });
  });

  describe("statuses", () => {
    it("should parse a passed test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/passed.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "passed" }]);
    });

    it("should parse a failed test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/failed.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "failed" }]);
    });

    it("should parse a broken test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/broken.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "broken" }]);
    });

    it("should parse a skipped test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/skipped.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "skipped" }]);
    });

    it("should parse a canceled test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/canceled.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "skipped" }]);
    });

    it("should parse a pending test case", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/pending.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "skipped" }]);
    });

    it("should parse an unknown status", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/unknown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "unknown" }]);
    });

    it("should treat a missing status as unknown", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/statusMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "unknown" }]);
    });

    it("should treat an ill-formed status as unknown", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/statusInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "unknown" }]);
    });

    it("should not take casing into account", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/statuses/upperCase.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ status: "passed" }]);
    });
  });

  describe("timings", () => {
    it("should parse start and stop and calculate duration", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/wellDefined.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: 5, stop: 25, duration: 20 }]);
    });

    it("should skip duration if start is missing", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/startMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: undefined, stop: 25, duration: undefined }]);
    });

    it("should ignore ill-formed start and skip duration", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/startInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: undefined, stop: 25, duration: undefined }]);
    });

    it("should skip duration if stop is missing", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/stopMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: 5, stop: undefined, duration: undefined }]);
    });

    it("should ignore ill-formed stop and skip duration", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/stopInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: 5, stop: undefined, duration: undefined }]);
    });

    it("should set duration to zero if start is greater than stop", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/timings/startGreaterThanStop.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ start: 25, stop: 5, duration: 0 }]);
    });
  });

  describe("labels", () => {
    it("should parse one test case label", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/oneTestCaseLabel.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: "foo", value: "bar" }] }]);
    });

    it("should parse two test case labels", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/twoTestCaseLabels.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          labels: [
            { name: "foo", value: "bar" },
            { name: "baz", value: "qux" },
          ],
        },
      ]);
    });

    it("should ignore an ill-formed test case labels collection", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/testCaseCollectionInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [] }]);
    });

    it("should ignore an ill-formed test case label element", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/testCaseLabelElementInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: "foo", value: "bar" }] }]);
    });

    it("should ignore an ill-formed test case label element", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/testCaseLabelElementInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: "foo", value: "bar" }] }]);
    });

    it("should handle a missing name", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/nameMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: undefined, value: "bar" }] }]);
    });

    it("should handle an ill-formed name", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/nameInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: undefined, value: "bar" }] }]);
    });

    it("should handle a missing value", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/valueMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: "foo", value: undefined }] }]);
    });

    it("should handle an ill-formed value", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/valueInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([{ labels: [{ name: "foo", value: undefined }] }]);
    });

    it("should parse one suite label", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/oneSuiteLabelTwoTestCases.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(2);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        { labels: [{ name: "foo", value: "bar" }] },
        { labels: [{ name: "foo", value: "bar" }] },
      ]);
    });

    it("should parse two suite labels", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/twoSuiteLabels.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          labels: [
            { name: "foo", value: "bar" },
            { name: "baz", value: "qux" },
          ],
        },
      ]);
    });

    it("should concat suite and case labels", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/labels/suiteAndTestCaseLabels.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          labels: [
            { name: "foo", value: "bar" },
            { name: "baz", value: "qux" },
          ],
        },
      ]);
    });

    describe("special labels", () => {
      it("should convert issue labels to links", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/issues.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            labels: [],
            links: [
              { name: "foo", url: "foo", type: "issue" },
              { name: "bar", url: "bar", type: "issue" },
            ],
          },
        ]);
      });

      it("should convert tms labels to links", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/tms.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            labels: [],
            links: [
              { name: "foo", url: "foo", type: "tms" },
              { name: "bar", url: "bar", type: "tms" },
            ],
          },
        ]);
      });

      it("should set historyId from label", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/historyId.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            historyId: "foo",
            labels: [],
          },
        ]);
      });

      it("should set testCaseId from label", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/testCaseId.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            testId: "foo",
            labels: [],
          },
        ]);
      });

      it("should set status detail properties from labels", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/statusDetails.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            flaky: true,
            muted: true,
            known: true,
            labels: [],
          },
        ]);
      });

      it("should ignore case when checking status detail labels", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/labels/special/statusDetailsUpperCase.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

        expect(trs).toMatchObject([
          {
            muted: true,
            labels: [],
          },
        ]);
      });
    });
  });

  describe("attachments", () => {
    it("should parse a test case attachments", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/wellDefinedAttachments.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [
          {
            type: "attachment",
            name: "foo",
            originalFileName: "bar",
            contentType: "text/plain",
          },
          {
            type: "attachment",
            name: "baz",
            originalFileName: "qux",
            contentType: "image/png",
          },
        ],
      });
    });

    it("should ignore a missing title", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/titleMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ name: undefined }],
      });
    });

    it("should ignore an invalid title", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/titleInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ name: undefined }],
      });
    });

    it("should ignore a missing source", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/sourceMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ originalFileName: undefined }],
      });
    });

    it("should ignore an invalid source", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/sourceInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ originalFileName: undefined }],
      });
    });

    it("should ignore a missing type", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/typeMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ contentType: undefined }],
      });
    });

    it("should ignore an invalid type", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/typeInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [{ contentType: undefined }],
      });
    });

    it("should ignore an ill-formed collection element", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/attachmentCollectionInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [],
      });
    });

    it("should ignore an ill-formed attachment element", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/attachments/attachmentInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        steps: [],
      });
    });
  });

  describe("parameters", () => {
    it("should parse a test parameter", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/wellDefined.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: "foo", value: "bar" }],
      });
    });

    it("should handle a missing name", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/nameMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: undefined, value: "bar" }],
      });
    });

    it("should ignore an ill-formed name", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/nameInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: undefined, value: "bar" }],
      });
    });

    it("should handle a missing value", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/valueMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: "foo", value: undefined }],
      });
    });

    it("should ignore an ill-formed value", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/valueInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: "foo", value: undefined }],
      });
    });

    it("should treat a missing kind as argument", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindMissing.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: "foo", value: "bar" }],
      });
    });

    it("should ignore an argument with an ill-formed kind", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [],
      });
    });

    it("should not take the casing into account when checking the kind", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindArgUpperCase.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [{ name: "foo", value: "bar" }],
      });
    });

    it("should parse environment variables", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindEnvVar.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [], // Environment variables are currently ignored
      });
    });

    it("should parse system properties", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindSysProp.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [], // System properties are currently ignored
      });
    });

    it("should ignore arguments of unknown kind", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/parameters/kindUnknown.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
      expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
        parameters: [],
      });
    });
  });

  describe("steps", () => {
    it("should parse a step", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/steps/oneWellDefinedStep.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.steps).toMatchObject([
        {
          name: "foo",
          type: "step",
        },
      ]);
    });

    it("should parse nested steps", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/steps/nesting.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
      const tr = trs[0];

      expect(tr.steps).toMatchObject([
        {
          name: "step 1",
          steps: [{ name: "step 1.1" }, { name: "step 1.2" }, { name: "step 1.3" }],
        },
        { name: "step 2" },
        { name: "step 3" },
      ]);
    });

    it("should ignore an invalid steps collection", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/steps/collectionInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          steps: [],
        },
      ]);
    });

    it("should ignore steps if the collection contains an invalid step", async () => {
      const visitor = await readResults(allure1, {
        "allure1data/steps/stepInvalid.xml": randomTestsuiteFileName(),
      });

      expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

      const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

      expect(trs).toMatchObject([
        {
          steps: [],
        },
      ]);
    });

    describe("names", () => {
      it("should prioritize title if given", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/names/titleAndName.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ name: "foo" }]);
      });

      it("should use name if title is missing", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/names/titleMissingWithName.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ name: "foo" }]);
      });

      it("should use name if title is ill-formed", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/names/titleInvalidWithName.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ name: "baz" }]);
      });

      it("should use placeholder if title and name are both missing", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/names/titleAndNameMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ name: "The step's name is not defined" }]);
      });
    });

    describe("statuses", () => {
      it("should parse a passed step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/passed.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "passed" }]);
      });

      it("should parse a failed step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/failed.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "failed" }]);
      });

      it("should parse a broken step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/broken.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "broken" }]);
      });

      it("should parse a skipped step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/skipped.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "skipped" }]);
      });

      it("should parse a canceled step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/canceled.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "skipped" }]);
      });

      it("should parse a pending step", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/pending.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "skipped" }]);
      });

      it("should parse an unknown status", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/unknown.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "unknown" }]);
      });

      it("should treat a missing status as unknown", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/statusMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "unknown" }]);
      });

      it("should treat an ill-formed status as unknown", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/statusInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "unknown" }]);
      });

      it("should not take casing into account", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/statuses/upperCase.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ status: "passed" }]);
      });
    });

    describe("timings", () => {
      it("should parse start and stop and calculate duration", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/wellDefined.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: 1, stop: 11, duration: 10 }]);
      });

      it("should skip duration if start is missing", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/startMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: undefined, stop: 11, duration: undefined }]);
      });

      it("should ignore ill-formed start and skip duration", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/startInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: undefined, stop: 11, duration: undefined }]);
      });

      it("should skip duration if stop is missing", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/stopMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: 1, stop: undefined, duration: undefined }]);
      });

      it("should ignore ill-formed stop and skip duration", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/stopInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: 1, stop: undefined, duration: undefined }]);
      });

      it("should set duration to zero if start is greater than stop", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/timings/startGreaterThanStop.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

        const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
        const tr = trs[0];

        expect(tr.steps).toMatchObject([{ start: 11, stop: 1, duration: 0 }]);
      });
    });

    describe("attachments", () => {
      it("should parse step attachments", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/wellDefinedAttachments.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [
            {
              steps: [
                {
                  type: "attachment",
                  name: "foo",
                  originalFileName: "bar",
                  contentType: "text/plain",
                },
                {
                  type: "attachment",
                  name: "baz",
                  originalFileName: "qux",
                  contentType: "image/png",
                },
              ],
            },
          ],
        });
      });

      it("should ignore a missing title", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/titleMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ name: undefined }] }],
        });
      });

      it("should ignore an invalid title", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/titleInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ name: undefined }] }],
        });
      });

      it("should ignore a missing source", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/sourceMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ originalFileName: undefined }] }],
        });
      });

      it("should ignore an invalid source", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/sourceInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ originalFileName: undefined }] }],
        });
      });

      it("should ignore a missing type", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/typeMissing.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ contentType: undefined }] }],
        });
      });

      it("should ignore an invalid type", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/typeInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [{ contentType: undefined }] }],
        });
      });

      it("should ignore an ill-formed collection element", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/attachmentCollectionInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [] }],
        });
      });

      it("should ignore an ill-formed attachment element", async () => {
        const visitor = await readResults(allure1, {
          "allure1data/steps/attachments/attachmentInvalid.xml": randomTestsuiteFileName(),
        });

        expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
        expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
          steps: [{ steps: [] }],
        });
      });
    });
  });
});
