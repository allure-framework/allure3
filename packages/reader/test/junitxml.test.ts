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

  it("should parse test failure", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/failure.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "shouldReadFailures",
          status: "failed",
          message: "Expected: is <Present>\n" + "     but: was <Empty>",
          trace:
            "java.lang.AssertionError:\n" +
            "        Expected: is <Present>\n" +
            "        but: was <Empty>\n" +
            "        at org.hamcrest.MatcherAssert.assertThat(MatcherAssert.java:20)\n" +
            "        at org.hamcrest.MatcherAssert.assertThat(MatcherAssert.java:8)\n" +
            "        at org.allurefw.report.junit.JunitXmlPluginTest.shouldReadFailures(JunitTestResultsTest.java:99)\n" +
            "        at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n" +
            "        at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n" +
            "        at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n" +
            "        at java.lang.reflect.Method.invoke(Method.java:498)\n" +
            "        at org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:50)\n" +
            "        at org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)\n" +
            "        at org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:47)\n" +
            "        at org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)\n" +
            "        at org.junit.internal.runners.statements.RunBefores.evaluate(RunBefores.java:26)\n" +
            "        at org.junit.rules.ExternalResource$1.evaluate(ExternalResource.java:48)\n" +
            "        at org.junit.rules.RunRules.evaluate(RunRules.java:20)\n" +
            "        at org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:325)\n" +
            "        at org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:78)\n" +
            "        at org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:57)\n" +
            "        at org.junit.runners.ParentRunner$3.run(ParentRunner.java:290)\n" +
            "        at org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:71)\n" +
            "        at org.junit.runners.ParentRunner.runChildren(ParentRunner.java:288)\n" +
            "        at org.junit.runners.ParentRunner.access$000(ParentRunner.java:58)\n" +
            "        at org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:268)\n" +
            "        at org.junit.runners.ParentRunner.run(ParentRunner.java:363)\n" +
            "        at org.apache.maven.surefire.junit4.JUnit4Provider.execute(JUnit4Provider.java:252)\n" +
            "        at org.apache.maven.surefire.junit4.JUnit4Provider.executeTestSet(JUnit4Provider.java:141)\n" +
            "        at org.apache.maven.surefire.junit4.JUnit4Provider.invoke(JUnit4Provider.java:112)\n" +
            "        at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n" +
            "        at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n" +
            "        at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n" +
            "        at java.lang.reflect.Method.invoke(Method.java:498)\n" +
            "        at org.apache.maven.surefire.util.ReflectionUtils.invokeMethodWithArray(ReflectionUtils.java:189)\n" +
            "        at org.apache.maven.surefire.booter.ProviderFactory$ProviderProxy.invoke(ProviderFactory.java:165)\n" +
            "        at org.apache.maven.surefire.booter.ProviderFactory.invokeProvider(ProviderFactory.java:85)\n" +
            "        at org.apache.maven.surefire.booter.ForkedBooter.runSuitesInProcess(ForkedBooter.java:115)\n" +
            "        at org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:75)",
        }),
      ]),
    );
  });

  it("should parse skipped tests", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/skipped.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: "shouldReadFailures", status: "skipped", message: "Add support of retries" }),
      ]),
    );
  });

  it("should parse cdata trace", async () => {
    const visitor = await readResults(junitXml, {
      "junitxmldata/cdata-trace.xml": randomTestsuiteFileName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);

    const trs = visitor.visitTestResult.mock.calls.map((c) => c[0]);

    expect(trs).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test1",
          status: "failed",
          message: "some-message",
          trace: "some-trace",
        }),
      ]),
    );
  });
});
