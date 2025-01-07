/* eslint @typescript-eslint/unbound-method: 0, max-lines: 0 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allure1 } from "../src/index.js";
import { mockVisitor, readResourceAsResultFile, readResults } from "./utils.js";

const randomTestsuiteFileName = () => `${randomUUID()}-testsuite.xml`;

const failureTrace =
  "java.lang.RuntimeException: bye-bye\n" +
  "                    at my.company.BeforeClassFailTest.setUp(BeforeClassFailTest.java:14)\n" +
  "                    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n" +
  "                    at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:57)\n" +
  "                    at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n" +
  "                    at java.lang.reflect.Method.invoke(Method.java:601)\n" +
  "                    at org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:47)\n" +
  "                    at org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)\n" +
  "                    at org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:44)\n" +
  "                    at org.junit.internal.runners.statements.RunBefores.evaluate(RunBefores.java:24)\n" +
  "                    at org.junit.runners.ParentRunner.run(ParentRunner.java:309)\n" +
  "                    at org.junit.runners.Suite.runChild(Suite.java:127)\n" +
  "                    at org.junit.runners.Suite.runChild(Suite.java:26)\n" +
  "                    at org.junit.runners.ParentRunner$3.run(ParentRunner.java:238)\n" +
  "                    at org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:63)\n" +
  "                    at org.junit.runners.ParentRunner.runChildren(ParentRunner.java:236)\n" +
  "                    at org.junit.runners.ParentRunner.access$000(ParentRunner.java:53)\n" +
  "                    at org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:229)\n" +
  "                    at org.junit.runners.ParentRunner.run(ParentRunner.java:309)\n" +
  "                    at org.junit.runner.JUnitCore.run(JUnitCore.java:160)\n" +
  "                    at org.junit.runner.JUnitCore.run(JUnitCore.java:138)\n" +
  "                    at\n" +
  "                    org.apache.maven.surefire.junitcore.JUnitCoreWrapper.createReqestAndRun(JUnitCoreWrapper.java:139)\n" +
  "                    at org.apache.maven.surefire.junitcore.JUnitCoreWrapper.executeEager(JUnitCoreWrapper.java:111)\n" +
  "                    at org.apache.maven.surefire.junitcore.JUnitCoreWrapper.execute(JUnitCoreWrapper.java:84)\n" +
  "                    at org.apache.maven.surefire.junitcore.JUnitCoreProvider.invoke(JUnitCoreProvider.java:141)\n" +
  "                    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n" +
  "                    at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:57)\n" +
  "                    at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n" +
  "                    at java.lang.reflect.Method.invoke(Method.java:601)\n" +
  "                    at org.apache.maven.surefire.util.ReflectionUtils.invokeMethodWithArray2(ReflectionUtils.java:208)\n" +
  "                    at org.apache.maven.surefire.booter.ProviderFactory$ProviderProxy.invoke(ProviderFactory.java:158)\n" +
  "                    at org.apache.maven.surefire.booter.ProviderFactory.invokeProvider(ProviderFactory.java:86)\n" +
  "                    at org.apache.maven.surefire.booter.ForkedBooter.runSuitesInProcess(ForkedBooter.java:153)\n" +
  "                    at org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:95)";

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

  it("should parse invalid or missing status", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/empty-status.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(4);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "testOne", status: "unknown" }),
        expect.objectContaining({ name: "testTwo", status: "passed" }),
        expect.objectContaining({ name: "testThree", status: "failed" }),
        expect.objectContaining({ name: "testFour", status: "unknown" }),
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

  it("should parse start and stop", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/single.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "testOne", start: 1412949539363, stop: 1412949539715, duration: 352 }),
      ]),
    );
  });

  it("should parse message and trace", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/failure.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "testOne",
          status: "failed",
          message: "RuntimeException: bye-bye",
          trace: failureTrace,
        }),
      ]),
    );
  });

  it("should parse trace without message", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/trace-without-message.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "testOne",
          status: "failed",
          trace: failureTrace,
        }),
      ]),
    );
  });

  it("should parse parameters", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/params.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
    const tr = trs[0];

    expect(tr.parameters).toMatchObject(
      expect.arrayContaining([
        { name: "first param", value: "value 1" },
        { name: "second param", value: "value 2" },
        { value: "value 2" },
        { name: "name 4" },
        { name: "name 5", value: "value 5" },
      ]),
    );
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

  describe("steps", () => {
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
      it("should parse a step attachments", async () => {
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
