/* eslint no-underscore-dangle: ["error", { "allow": ["_name", "_type", "_value", "_values"] }] */
import type { ShallowKnown, Unknown } from "../../../validation.js";
import {
  ensureArray,
  ensureBoolean,
  ensureInt,
  ensureLiteral,
  ensureNumber,
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

export const getValue = <Type extends string, Result>(
  value: Unknown<XcValue<Type, Result>>,
  ensure: (v: Unknown<Result>) => Result | undefined,
) => {
  const obj = ensureObject(value);
  return obj ? ensure(obj._value) : undefined;
};

export const getBool = (value: Unknown<XcBool>) => getValue(value, ensureBoolean);

export const getInt = (value: Unknown<XcInt>) => getValue(value, ensureInt);

export const getDouble = (value: Unknown<XcDouble>) => getValue(value, ensureNumber);

export const getString = (value: Unknown<XcString>) => getValue(value, ensureString);

export const getDate = (value: Unknown<XcDate>) => {
  const text = getValue(value, ensureString);
  return text ? Date.parse(text) : undefined;
};

export const getURL = (value: Unknown<XcURL>) => getValue(value, ensureString);

export const getRef = (ref: Unknown<XcReference>) => {
  const obj = ensureObject(ref);
  return obj ? getString(obj.id) : undefined;
};

export const getArray = <Type extends string, Element extends XcObject<Type>>(array: Unknown<XcArray<Element>>) => {
  const arrayObject = ensureObject(array);
  return arrayObject ? (ensureArray(arrayObject._values) ?? []) : [];
};

const getValueArray = <Type extends string, Result, Element extends XcValue<Type, Result>>(
  array: Unknown<XcArray<Element>>,
  getElement: (v: Unknown<Element>) => Result | undefined,
) => getArray(array).map(getElement).filter(isDefined);

export const getStringArray = (array: Unknown<XcArray<XcString>>) => getValueArray(array, getString);

export const getObjectArray = <Type extends string, Element extends XcObject<Type>>(
  array: Unknown<XcArray<Element>>,
) => {
  return getArray(array).filter((v): v is ShallowKnown<Element> => isObject(v as any));
};
