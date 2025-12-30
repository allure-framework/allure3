import {
  collectCliToolStdoutText,
  invokeCliTool,
  invokeJsonCliTool,
  invokeStdoutCliTool,
} from "@allurereport/reader-api";
import console from "node:console";
import type { XcActivities, XcTestDetails, XcTests } from "./xcModel.js";

export const xcrunJson = async <T>(utilityName: string, ...args: readonly string[]) => {
  try {
    return await invokeJsonCliTool<T>("xcrun", [utilityName, ...args], { timeout: 10000 });
  } catch (e) {
    console.error(e);
  }
};

export const xcrunBinary = async (utilityName: string, ...args: readonly string[]) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of invokeStdoutCliTool("xcrun", [utilityName, ...args], { timeout: 60000 })) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (e) {
    console.error(e);
  }
};

export const xcresulttool = async <T>(...args: readonly string[]) => await xcrunJson<T>("xcresulttool", ...args);

export const xcresulttoolBinary = async (...args: readonly string[]) => await xcrunBinary("xcresulttool", ...args);

export const version = async () => {
  const stdout = await collectCliToolStdoutText("xcrun", ["xcresulttool", "version"], { timeout: 10000 });
  return stdout.trim();
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
