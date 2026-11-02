import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { BufferResultFile, PathResultFile } from "@allurereport/reader-api";
import { expect, it, onTestFinished } from "vite-plus/test";

import { resolveConfig } from "../../src/config.js";
import { AllureReport } from "../../src/report.js";

const createReport = async (matcher = '${{ labels[labels.size()].value == "firefox" }}', dynamic = false) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-environment-errors-"));
  const config = await resolveConfig(
    { environments: { firefox: { matcher } }, dynamicEnvironments: dynamic ? { label: "host" } : undefined },
    { cwd, output: join(cwd, "report"), plugins: {} },
  );
  const report = new AllureReport({ ...config, dump: dynamic ? join(cwd, "state") : undefined });
  onTestFinished(async () => {
    await report.done();
    await rm(cwd, { recursive: true, force: true });
  });
  await report.start();
  return { cwd, report };
};

const failure = 'Invalid expression at environments["firefox"].matcher';
const result = JSON.stringify({ uuid: "test", name: "test", status: "passed", labels: [] });

it("propagates environment expression failures from Allure 2 results", async () => {
  const { report } = await createReport();

  await expect(report.readResult(new BufferResultFile(Buffer.from(result), "test-result.json"))).rejects.toThrow(
    failure,
  );
});

it.each([
  ["Allure 1", "allure1data/without-namespace.xml", "test-testsuite.xml"],
  ["JUnit", "junitxmldata/single.xml", "junit.xml"],
  ["Cucumber JSON", "cucumberjsondata/reference/names/wellDefined.json", "cucumber.json"],
  ["Cucumber messages", "cucumbermessages/sample.jsonl", "messages.jsonl"],
])("propagates environment expression failures from %s results", async (_format, fixture, fileName) => {
  const { report } = await createReport();
  const file = new PathResultFile(resolve("../reader/test/resources", fixture), fileName);

  await expect(report.readResult(file)).rejects.toThrow(failure);
});

it("propagates environment expression failures from Open Test Reporting results", async () => {
  const { report } = await createReport();
  const xml =
    '<execution xmlns="https://schemas.opentest4j.org/reporting/hierarchy/0.2.0"><root name="test"/></execution>';

  await expect(report.readResult(new BufferResultFile(Buffer.from(xml), "report.xml"))).rejects.toThrow(failure);
});

it("propagates environment expression failures through directory ingestion", async () => {
  const { cwd, report } = await createReport();
  const resultsDir = join(cwd, "results");
  await mkdir(resultsDir);
  await writeFile(join(resultsDir, "test-result.json"), result);

  await expect(report.readDirectory(resultsDir)).rejects.toThrow(failure);
});

it("identifies the result file that triggered an expression failure", async () => {
  const { report } = await createReport();

  const error = await report
    .readResult(new BufferResultFile(Buffer.from(result), "affected-result.json"))
    .catch((cause: Error) => cause);

  expect((error as Error).message).toContain("affected-result.json");
});

it("rejects fatal environment errors during public dump restoration", async () => {
  const source = await createReport("${{ false }}", true);
  const target = await createReport(undefined, true);
  await source.report.readResult(
    new BufferResultFile(
      Buffer.from(
        JSON.stringify({
          uuid: "restored",
          name: "restored",
          status: "passed",
          labels: [{ name: "host", value: "alpha" }],
        }),
      ),
      "restored-result.json",
    ),
  );
  await source.report.dumpState();

  const restoration = target.report.restoreState([join(source.cwd, "state.zip")]);

  await expect(restoration).rejects.toThrow(failure);
});

it("continues past malformed results while evaluating valid results", async () => {
  const { cwd, report } = await createReport("${{ labels.size() == 0 }}");
  const resultsDir = join(cwd, "results");
  await mkdir(resultsDir);
  await writeFile(join(resultsDir, "invalid-result.json"), "{");
  await writeFile(join(resultsDir, "test-result.json"), result);

  await report.readDirectory(resultsDir);

  expect(await report.store.allTestResults()).toHaveLength(1);
});
