/* eslint no-underscore-dangle: ["error", { "allow": ["_value"] }] */
import type { Unknown } from "../../../validation.js";
import { ensureObject, ensureString } from "../../../validation.js";
import type { XcReference, XcString } from "./model.js";

export const getString = (value: Unknown<XcString>) => {
  const obj = ensureObject(value);
  return obj ? ensureString(obj._value) : undefined;
};

export const getRef = (ref: Unknown<XcReference>) => {
  const obj = ensureObject(ref);
  return obj ? getString(obj.id) : undefined;
};
