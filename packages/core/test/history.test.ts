import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path/posix";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AllureLocalHistory, writeHistory } from "../src/history.js";

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "allure3-core-tests-"));
});

afterEach(async () => {
  if (tmp) {
    await rm(tmp, { recursive: true });
  }
});

it("should read empty file", async () => {
  const fileName = `${randomUUID()}.json`;
  const historyPath = join(tmp, fileName);
  const history = new AllureLocalHistory(historyPath);

  await writeFile(historyPath, "", { encoding: "utf8" });

  const result = await history.readHistory();

  expect(result).toEqual([]);
});

it("should process file that doesn't exists", async () => {
  const fileName = `${randomUUID()}.json`;
  const historyPath = join(tmp, fileName);
  const history = new AllureLocalHistory(historyPath);
  const result = await history.readHistory();

  expect(result).toEqual([]);
});

it("should create history file", async () => {
  const fileName = `${randomUUID()}.json`;
  const historyPath = join(tmp, fileName);
  const history = new AllureLocalHistory(historyPath);
  const data = {
    uuid: randomUUID(),
    timestamp: new Date().getTime(),
    name: "Allure Report",
    testResults: {},
    knownTestCaseIds: [],
    metrics: {},
    url: "",
  };

  await writeHistory(historyPath, data);

  const stats = await stat(historyPath);

  expect(stats.isFile()).toBeTruthy();

  const result = await history.readHistory();

  expect(result).toEqual([expect.objectContaining(data)]);
});

it("should append data to existing history file", async () => {
  const fileName = `${randomUUID()}.json`;
  const historyPath = join(tmp, fileName);
  const history = new AllureLocalHistory(historyPath);

  await writeFile(historyPath, "", { encoding: "utf8" });

  const data = {
    uuid: randomUUID(),
    timestamp: new Date().getTime(),
    name: "Allure Report",
    testResults: {},
    knownTestCaseIds: [],
    metrics: {},
    url: "",
  };
  await writeHistory(historyPath, data);

  const stats = await stat(historyPath);

  expect(stats.isFile()).toBeTruthy();

  const result = await history.readHistory();

  expect(result).toEqual([expect.objectContaining(data)]);
});

it("should read multiple data points from history file", async () => {
  const fileName = `${randomUUID()}.json`;
  const historyPath = join(tmp, fileName);
  const history = new AllureLocalHistory(historyPath);

  await writeFile(historyPath, "", { encoding: "utf8" });

  const data1 = {
    uuid: randomUUID(),
    timestamp: new Date().getTime() - 1000,
    name: "Allure Report",
    testResults: {},
    knownTestCaseIds: ["a"],
    metrics: {},
    url: "",
  };

  const data2 = {
    uuid: randomUUID(),
    timestamp: new Date().getTime() - 500,
    name: "Allure Report",
    testResults: {},
    knownTestCaseIds: ["a", "b"],
    metrics: {},
    url: "",
  };

  const data3 = {
    uuid: randomUUID(),
    timestamp: new Date().getTime(),
    name: "Allure Report",
    testResults: {},
    knownTestCaseIds: ["a", "c"],
    metrics: {},
    url: "",
  };

  await writeHistory(historyPath, data1);
  await writeHistory(historyPath, data2);
  await writeHistory(historyPath, data3);

  const stats = await stat(historyPath);

  expect(stats.isFile()).toBeTruthy();

  const result = await history.readHistory();

  expect(result).toEqual([
    expect.objectContaining(data1),
    expect.objectContaining(data2),
    expect.objectContaining(data3),
  ]);
});
