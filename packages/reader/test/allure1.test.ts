import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allure1 } from "../src/index.js";
import { mockVisitor, readResourceAsResultFile, readResults } from "./utils.js";

const randomTestsuiteFileName = () => randomUUID() + "-testsuite.xml";

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

  it("should parse steps", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/steps.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
    const tr = trs[0];

    expect(tr.steps).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "step 1",
          status: "passed",
          start: 1412949529363,
          stop: 1412949531730,
          duration: 2367,
        }),
        expect.objectContaining({
          name: "step 2",
          status: "broken",
          start: 1412949529363,
          stop: 1412949535730,
          duration: 6367,
        }),
        expect.objectContaining({
          name: "step 3",
          status: "passed",
          start: 1412949529363,
          stop: 1412949536730,
          duration: 7367,
        }),
      ]),
    );
  });

  it.skip("should parse attachments", async () => {
    const visitor = await readResults(allure1, {
      "allure1data/attachments.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);
    const tr = trs[0];

    console.log("res", JSON.stringify(tr, null, " "));

    expect(tr.steps).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "some-attachment",
          originalFileName: "sample-attachment.txt",
          contentType: "text/plain",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "other-attachment",
          originalFileName: "other-attachment.txt",
          contentType: "text/plain",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "image-attachment",
          originalFileName: "image-attachment.txt",
          contentType: "image/png",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "no-type-attachment",
          originalFileName: "no-type-attachment.txt",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "no-source-attachment",
          contentType: "text/plain",
          type: "attachment",
        }),
        expect.objectContaining({
          originalFileName: "no-title-attachment",
          contentType: "text/plain",
          type: "attachment",
        }),
      ]),
    );
  });
});
