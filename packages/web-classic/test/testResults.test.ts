import { feature, label, step } from "allure-js-commons";
import { beforeEach, expect, it, vi } from "vite-plus/test";

import { fetchTestResult, testResultStore } from "../src/stores/testResults.js";

const { fetchReportJsonData } = vi.hoisted(() => ({ fetchReportJsonData: vi.fn() }));
vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportJsonData,
}));

beforeEach(async () => {
  await feature("test-result-routing");
  await label("layer", "unit");
  fetchReportJsonData.mockReset();
  testResultStore.value = { loading: false, error: undefined, data: undefined };
});

it("keeps loading the current result when an older request succeeds", async () => {
  const old = Promise.withResolvers<{ name: string }>();
  const current = Promise.withResolvers<{ name: string }>();
  fetchReportJsonData.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const first = fetchTestResult("old");
  const second = fetchTestResult("current");

  await step("Finish the old result while the current result is still pending", async () => {
    old.resolve({ name: "Old result" });
    await first;
    expect(testResultStore.value.loading).toBe(true);
    expect(testResultStore.value.data).toBeUndefined();
  });

  current.resolve({ name: "Current result" });
  await second;
  expect(testResultStore.value.loading).toBe(false);
  expect(testResultStore.value.data).toEqual({ current: { name: "Current result" } });
});

it("preserves a current request failure when an older request succeeds", async () => {
  const old = Promise.withResolvers<{ name: string }>();
  const current = Promise.withResolvers<{ name: string }>();
  fetchReportJsonData.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const first = fetchTestResult("old");
  const second = fetchTestResult("current");
  current.reject(new Error("Current request failed"));
  await second;

  await step("Finish the stale success after the current error is displayed", async () => {
    old.resolve({ name: "Old result" });
    await first;
    expect(testResultStore.value.error).toBe("Current request failed");
    expect(testResultStore.value.loading).toBe(false);
    expect(testResultStore.value.data).toBeUndefined();
  });
});

it("keeps the newest response when the same result is requested twice", async () => {
  const old = Promise.withResolvers<{ name: string }>();
  const current = Promise.withResolvers<{ name: string }>();
  fetchReportJsonData.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const first = fetchTestResult("result");
  const second = fetchTestResult("result");
  current.resolve({ name: "Updated result" });
  await second;

  await step("Finish the previous response for the same result ID", async () => {
    old.resolve({ name: "Old result" });
    await first;
    expect(testResultStore.value.data).toEqual({ result: { name: "Updated result" } });
    expect(testResultStore.value.error).toBeUndefined();
  });
});
