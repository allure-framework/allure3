// empty xml elements will be parsed as empty strings,
export const isEmptyElement = (obj: unknown): obj is "" => {
  return obj === "";
};

export const isStringAnyRecord = (obj: unknown): obj is Record<string, any> => {
  if (typeof obj !== "object") {
    return false;
  }

  if (Array.isArray(obj)) {
    return false;
  }

  return Object.getOwnPropertySymbols(obj).length <= 0;
};

export const isStringAnyRecordArray = (obj: unknown): obj is Record<string, any>[] => {
  return Array.isArray(obj) && obj.every((item) => isStringAnyRecord(item));
};

// codes of chars - " \t\r\n\ud800\ue000\ufffe\uffff"
export const isBadXmlCharacter = (c: number): boolean => {
  let cDataCharacter = c < 32 && c !== 9 && c !== 13 && c !== 10;
  cDataCharacter ||= c >= 55296 && c < 57344;
  cDataCharacter ||= c === 65534 || c === 65535;
  return cDataCharacter;
};

export const cleanBadXmlCharacters = (input: Buffer): Buffer => {
  for (let i = 0; i < input.length; i++) {
    if (isBadXmlCharacter(input[i])) {
      // replace with space
      input[i] = 32;
    }
  }
  return input;
};
