import console from "node:console";
import type { Unknown } from "../../../validation.js";
import { xcresulttool } from "../cli.js";
import { getRef } from "./parsing.js";
import type { XcActionsInvocationRecord, XcReference } from "./xcModel.js";

let legacyRunSucceeded = false;
let noLegacyApi = false;

export const legacyApiUnavailable = () => !legacyRunSucceeded && noLegacyApi;

export const xcresulttoolGetLegacy = async <T>(
  xcResultPath: string,
  ...args: readonly string[]
): Promise<Unknown<T>> => {
  if (noLegacyApi) {
    return undefined;
  }

  const result = await xcresulttool<T>("get", "--legacy", "--format", "json", "--path", xcResultPath, ...args);
  if (typeof result === "undefined") {
    if (!legacyRunSucceeded) {
      noLegacyApi = true;
      console.warn("The legacy API of xcresulttool is unavailable");
    }
    return undefined;
  }

  legacyRunSucceeded = true;
  return result;
};

export const getRoot = async (xcResultPath: string) =>
  await xcresulttoolGetLegacy<XcActionsInvocationRecord>(xcResultPath);

export const getById = async <T>(xcResultPath: string, ref: Unknown<XcReference>) => {
  const id = getRef(ref);
  return id ? await xcresulttoolGetLegacy<T>(xcResultPath, "--id", id) : undefined;
};
