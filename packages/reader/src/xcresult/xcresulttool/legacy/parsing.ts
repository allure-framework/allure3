/* eslint no-underscore-dangle: ["error", { "allow": ["_name", "_type", "_value", "_values"] }] */
import type { ShallowKnown, Unknown } from "../../../validation.js";
import {
  ensureArray,
  ensureFloat,
  ensureInt,
  ensureLiteral,
  ensureObject,
  ensureString,
  isDefined,
  isObject,
} from "../../../validation.js";
import type {
  XcArray,
  XcBool,
  XcDate,
  XcDouble,
  XcInt,
  XcObject,
  XcReference,
  XcString,
  XcURL,
  XcValue,
} from "./xcModel.js";

export const getType = <Type extends string>({ _type }: ShallowKnown<XcObject<Type>>) =>
  isObject(_type) ? ensureString(_type._name) : undefined;

export const getUnionType = <Type extends string, const L extends readonly string[]>(
  { _type }: ShallowKnown<XcObject<Type>>,
  options: L,
) => (isObject(_type) ? ensureLiteral(_type._name, options) : undefined);

export const getValue = <Type extends string>(value: Unknown<XcValue<Type>>) => {
  const obj = ensureObject(value);
  return obj ? ensureString(obj._value) : undefined;
};

export const getBool = (value: Unknown<XcBool>) => {
  const text = getValue(value);
  return text === "true";
};

export const getInt = (value: Unknown<XcInt>) => {
  const text = getValue(value);
  return text ? ensureInt(text) : undefined;
};

export const getDouble = (value: Unknown<XcDouble>) => {
  const text = getValue(value);
  return text ? ensureFloat(text) : undefined;
};

export const getString = (value: Unknown<XcString>) => getValue(value);

export const getDate = (value: Unknown<XcDate>) => {
  const text = getValue(value);
  if (text) {
    const parsed = Date.parse(text);
    return isNaN(parsed) ? undefined : parsed;
  }
};

export const getURL = (value: Unknown<XcURL>) => getValue(value);

export const getRef = (ref: Unknown<XcReference>) => {
  const obj = ensureObject(ref);
  return obj ? getString(obj.id) : undefined;
};

export const getArray = <Type extends string, Element extends XcObject<Type>>(array: Unknown<XcArray<Element>>) => {
  const arrayObject = ensureObject(array);
  return arrayObject ? (ensureArray(arrayObject._values) ?? []) : [];
};

const getValueArray = <Type extends string, Result, Element extends XcValue<Type>>(
  array: Unknown<XcArray<Element>>,
  getElement: (v: Unknown<Element>) => Result | undefined,
) => getArray(array).map(getElement).filter(isDefined);

export const getStringArray = (array: Unknown<XcArray<XcString>>) => getValueArray(array, getString);

export const getObjectArray = <Type extends string, Element extends XcObject<Type>>(
  array: Unknown<XcArray<Element>>,
) => {
  return getArray(array).filter((v): v is ShallowKnown<Element> => isObject(v as any));
};
