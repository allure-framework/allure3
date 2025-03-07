import console from "node:console";
import { invokeCliTool, invokeJsonCliTool, invokeStdoutCliTool } from "../../toolRunner.js";
import type { XcActivities, XcTestDetails, XcTests } from "./xcModel.js";

export const xcrun = async <T>(utilityName: string, ...args: readonly string[]) => {
  try {
    return await invokeJsonCliTool<T>("xcrun", [utilityName, ...args], { timeout: 1000 });
  } catch (e) {
    console.error(e);
  }
};

export const xcresulttool = async <T>(...args: readonly string[]) => await xcrun<T>("xcresulttool", ...args);

export const version = async () => {
  const stdout = invokeStdoutCliTool("xcrun", ["xcresulttool", "version"], { timeout: 1000 });
  const lines: string[] = [];
  for await (const line of stdout) {
    lines.push(line);
  }
  return lines.join("\n");
};

export const getTests = async (xcResultPath: string) =>
  await xcresulttool<XcTests>("get", "test-results", "tests", "--path", xcResultPath);

export const getTestDetails = async (xcResultPath: string, testId: string) =>
  await xcresulttool<XcTestDetails>("get", "test-results", "test-details", "--test-id", testId, "--path", xcResultPath);

export const getTestActivities = async (xcResultPath: string, testId: string) =>
  await xcresulttool<XcActivities>("get", "test-results", "activities", "--test-id", testId, "--path", xcResultPath);

export const exportAttachments = async (xcResultPath: string, outputPath: string) => {
  await invokeCliTool("xcrun", [
    "xcresulttool",
    "export",
    "attachments",
    "--path",
    xcResultPath,
    "--output-path",
    outputPath,
  ]);
};
