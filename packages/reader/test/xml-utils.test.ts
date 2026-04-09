import { describe, expect, it } from "vitest";

import {
  cleanBadXmlCharacters,
  isBadXmlCharacter,
  isEmptyElement,
  isStringAnyRecord,
  isStringAnyRecordArray,
} from "../src/xml-utils.js";

describe("xml utility helpers", () => {
  it("should recognize empty xml elements and plain string-keyed records", () => {
    expect(isEmptyElement("")).toBe(true);
    expect(isEmptyElement("not-empty")).toBe(false);
    expect(isStringAnyRecord({ foo: "bar" })).toBe(true);
    expect(isStringAnyRecord(["foo"])).toBe(false);
    expect(isStringAnyRecordArray([{ foo: "bar" }, { bar: "baz" }])).toBe(true);
    expect(isStringAnyRecordArray([{ foo: "bar" }, ["baz"]])).toBe(false);
  });

  it("should identify and replace invalid xml characters", () => {
    expect(isBadXmlCharacter(0)).toBe(true);
    expect(isBadXmlCharacter(9)).toBe(false);
    expect(isBadXmlCharacter(10)).toBe(false);
    expect(isBadXmlCharacter(13)).toBe(false);

    const input = Buffer.from([65, 0, 66, 9, 67, 255]);
    const cleaned = cleanBadXmlCharacters(Buffer.from(input));

    expect(Array.from(cleaned)).toEqual([65, 32, 66, 9, 67, 255]);
  });
});
