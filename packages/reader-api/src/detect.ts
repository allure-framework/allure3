/* eslint-disable max-lines,no-bitwise */

// the detection algorithm is ported from tika-core:2.9.1
// https://tika.apache.org/

type RawAndClause = {
  clause: "and";
  nested: RawClause[];
};
type RawOrClause = {
  clause: "or";
  nested: RawClause[];
};
type RawMatchClause = {
  clause: "match";
  value: string;
  mask?: string;
  type: string;
  offset?: string;
};

type RawClause = RawAndClause | RawOrClause | RawMatchClause;
type RawMagic = {
  name: string;
  priority: number;
  clause: RawClause;
  extensions: string[];
};

const rawMagics: RawMagic[] = [
  {
    name: "video/mp4",
    priority: 60,
    clause: {
      clause: "match",
      value: "ftypmp42",
      type: "string",
      offset: "4",
    },
    extensions: [".mp4", ".mp4v", ".mpg4"],
  },
  {
    name: "video/mp4",
    priority: 60,
    clause: {
      clause: "match",
      value: "ftypmp41",
      type: "string",
      offset: "4",
    },
    extensions: [".mp4", ".mp4v", ".mpg4"],
  },
  {
    name: "image/svg+xml",
    priority: 50,
    clause: {
      clause: "and",
      nested: [
        {
          clause: "match",
          value: "<svg",
          type: "string",
          offset: "0",
        },
        {
          clause: "match",
          value: "http://www.w3.org/2000/svg",
          type: "string",
          offset: "5:256",
        },
      ],
    },
    extensions: [".svg", ".svgz"],
  },
  {
    name: "image/png",
    priority: 50,
    clause: {
      clause: "match",
      value: "\\x89PNG\\x0d\\x0a\\x1a\\x0a",
      type: "string",
      offset: "0",
    },
    extensions: [".png"],
  },
  {
    name: "application/x-gtar",
    priority: 50,
    clause: {
      clause: "match",
      value: "ustar  \\0",
      type: "string",
      offset: "257",
    },
    extensions: [".gtar"],
  },
  {
    name: "application/pdf",
    priority: 50,
    clause: {
      clause: "match",
      value: "\\xef\\xbb\\xbf%PDF-",
      type: "string",
      offset: "0",
    },
    extensions: [".pdf"],
  },
  {
    name: "image/gif",
    priority: 50,
    clause: {
      clause: "match",
      value: "GIF89a",
      type: "string",
      offset: "0",
    },
    extensions: [".gif"],
  },
  {
    name: "image/gif",
    priority: 50,
    clause: {
      clause: "match",
      value: "GIF87a",
      type: "string",
      offset: "0",
    },
    extensions: [".gif"],
  },
  {
    name: "image/bmp",
    priority: 50,
    clause: {
      clause: "and",
      nested: [
        {
          clause: "match",
          value: "BM",
          type: "string",
          offset: "0",
        },
        {
          clause: "and",
          nested: [
            {
              clause: "match",
              value: "0x0100",
              type: "string",
              offset: "26",
            },
            {
              clause: "or",
              nested: [
                {
                  clause: "match",
                  value: "0x0000",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x0100",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x0400",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x0800",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x1000",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x1800",
                  type: "string",
                  offset: "28",
                },
                {
                  clause: "match",
                  value: "0x2000",
                  type: "string",
                  offset: "28",
                },
              ],
            },
          ],
        },
      ],
    },
    extensions: [".bmp", ".dib"],
  },
  {
    name: "application/pdf",
    priority: 50,
    clause: {
      clause: "match",
      value: "%PDF-",
      type: "string",
      offset: "0",
    },
    extensions: [".pdf"],
  },
  {
    name: "image/tiff",
    priority: 50,
    clause: {
      clause: "match",
      value: "MM\\x00\\x2b",
      type: "string",
      offset: "0",
    },
    extensions: [".tiff", ".tif"],
  },
  {
    name: "image/tiff",
    priority: 50,
    clause: {
      clause: "match",
      value: "MM\\x00\\x2a",
      type: "string",
      offset: "0",
    },
    extensions: [".tiff", ".tif"],
  },
  {
    name: "image/tiff",
    priority: 50,
    clause: {
      clause: "match",
      value: "II\\x2a\\x00",
      type: "string",
      offset: "0",
    },
    extensions: [".tiff", ".tif"],
  },
  {
    name: "application/zip",
    priority: 50,
    clause: {
      clause: "match",
      value: "PK\\x07\\x08",
      type: "string",
      offset: "0",
    },
    extensions: [".zip"],
  },
  {
    name: "application/zip",
    priority: 50,
    clause: {
      clause: "match",
      value: "PK\\005\\006",
      type: "string",
      offset: "0",
    },
    extensions: [".zip"],
  },
  {
    name: "application/zip",
    priority: 50,
    clause: {
      clause: "match",
      value: "PK\\003\\004",
      type: "string",
      offset: "0",
    },
    extensions: [".zip"],
  },
  {
    name: "image/jpeg",
    priority: 50,
    clause: {
      clause: "match",
      value: "0xffd8ff",
      type: "string",
      offset: "0",
    },
    extensions: [".jpg", ".jpeg", ".jpe", ".jif", ".jfif", ".jfi"],
  },
  {
    name: "application/gzip",
    priority: 45,
    clause: {
      clause: "match",
      value: "\\x1f\\x8b",
      type: "string",
      offset: "0",
    },
    extensions: [".gz", ".tgz", "-gz"],
  },
  {
    name: "application/gzip",
    priority: 45,
    clause: {
      clause: "match",
      value: "\\037\\213",
      type: "string",
      offset: "0",
    },
    extensions: [".gz", ".tgz", "-gz"],
  },
  {
    name: "application/pdf",
    priority: 40,
    clause: {
      clause: "and",
      nested: [
        {
          clause: "match",
          value: "%%",
          type: "string",
          offset: "0:128",
        },
        {
          clause: "match",
          value: "%PDF-2.",
          type: "string",
          offset: "1:512",
        },
      ],
    },
    extensions: [".pdf"],
  },
  {
    name: "application/pdf",
    priority: 40,
    clause: {
      clause: "and",
      nested: [
        {
          clause: "match",
          value: "%%",
          type: "string",
          offset: "0:128",
        },
        {
          clause: "match",
          value: "%PDF-1.",
          type: "string",
          offset: "1:512",
        },
      ],
    },
    extensions: [".pdf"],
  },
  {
    name: "application/x-tar",
    priority: 40,
    clause: {
      clause: "match",
      value: "ustar\\0",
      type: "string",
      offset: "257",
    },
    extensions: [".tar"],
  },
  {
    name: "application/pdf",
    priority: 20,
    clause: {
      clause: "match",
      value: "%PDF-2.",
      type: "string",
      offset: "1:512",
    },
    extensions: [".pdf"],
  },
  {
    name: "application/pdf",
    priority: 20,
    clause: {
      clause: "match",
      value: "%PDF-1.",
      type: "string",
      offset: "1:512",
    },
    extensions: [".pdf"],
  },
];

const decodeString = (value: string, type: string): Uint8Array => {
  if (value.startsWith("0x")) {
    const vals = new Uint8Array((value.length - 2) / 2);
    for (let i = 0; i < vals.length; i++) {
      vals[i] = parseInt(value.substring(2 + i * 2, 4 + i * 2), 16);
    }
    return vals;
  }

  const decoded: number[] = [];

  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\") {
      if (value[i + 1] === "\\") {
        decoded.push(92); // ASCII code for '\'
        i++;
      } else if (value[i + 1] === "x") {
        decoded.push(parseInt(value.substring(i + 2, i + 4), 16));
        i += 3;
      } else if (value[i + 1] === "r") {
        decoded.push(13); // ASCII code for '\r'
        i++;
      } else if (value[i + 1] === "n") {
        decoded.push(10); // ASCII code for '\n'
        i++;
      } else {
        let j = i + 1;
        while (j < i + 4 && j < value.length && /\d/.test(value[j])) {
          j++;
        }
        decoded.push(parseInt(`0${value.substring(i + 1, j)}`, 10));
        i = j - 1;
      }
    } else {
      decoded.push(value.charCodeAt(i));
    }
  }

  const chars = decoded;
  let bytes: Uint8Array;

  if (type === "unicodeLE") {
    bytes = new Uint8Array(chars.length * 2);
    for (let i = 0; i < chars.length; i++) {
      bytes[i * 2] = chars[i] & 0xff;
      bytes[i * 2 + 1] = chars[i] >> 8;
    }
  } else if (type === "unicodeBE") {
    bytes = new Uint8Array(chars.length * 2);
    for (let i = 0; i < chars.length; i++) {
      bytes[i * 2] = chars[i] >> 8;
      bytes[i * 2 + 1] = chars[i] & 0xff;
    }
  } else {
    bytes = new Uint8Array(chars.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = chars[i];
    }
  }

  return bytes;
};

interface Clause {
  eval: (data: Uint8Array) => boolean;
}

class AndClause implements Clause {
  constructor(private clauses: Clause[]) {}

  eval(data: Uint8Array): boolean {
    for (const clause of this.clauses) {
      if (!clause.eval(data)) {
        return false;
      }
    }
    return true;
  }
}

class OrClause implements Clause {
  constructor(private clauses: Clause[]) {}

  eval(data: Uint8Array): boolean {
    for (const clause of this.clauses) {
      if (!clause.eval(data)) {
        return true;
      }
    }
    return false;
  }
}

class MagicMatchClause implements Clause {
  constructor(
    private pattern: Uint8Array,
    private mask: Uint8Array,
    private start: number = 0,
    private end: number = start,
  ) {}
  eval = (data: Uint8Array): boolean => {
    if (data.length < this.pattern.length + this.start) {
      return false;
    }

    for (let i = this.start; i <= this.end; i++) {
      let match = true;
      for (let j = 0; match && j < this.pattern.length; j++) {
        const masked = data[i + j] & this.mask[j];
        match = masked === this.pattern[j];
      }
      if (match) {
        return true;
      }
    }

    return false;
  };
}

const parseClause = (rawClause: RawClause): Clause => {
  if (rawClause.clause === "and") {
    return new AndClause(rawClause.nested.map((nested) => parseClause(nested)));
  }
  if (rawClause.clause === "or") {
    return new OrClause(rawClause.nested.map((nested) => parseClause(nested)));
  }
  return createMagicMatch(rawClause.value, rawClause.mask, rawClause.offset, rawClause.type);
};

const parseMagics = (data: RawMagic[]): Magic[] => {
  return data.map((m) => {
    return {
      priority: m.priority,
      type: m.name,
      extensions: m.extensions,
      clause: parseClause(m.clause),
    };
  });
};

const createMagicMatch = (value: string, mask?: string, offset?: string, type: string = "string") => {
  const decodedValue = decodeString(value, type);
  const decodedMask = mask ? decodeString(value, type) : undefined;
  const patternLength = Math.max(decodedValue.length, decodedMask?.length ?? 0);
  const resPattern = new Uint8Array(patternLength);
  const resMask = new Uint8Array(patternLength);
  for (let i = 0; i < patternLength; i++) {
    if (decodedMask && i < decodedMask.length) {
      resMask[i] = decodedMask[i];
    } else {
      resMask[i] = -1;
    }

    if (i < decodedValue.length) {
      resPattern[i] = decodedValue[i] & resMask[i];
    } else {
      resPattern[i] = 0;
    }
  }

  let start = 0;
  let end = 0;
  if (offset) {
    if (offset.indexOf(":") > 0) {
      const [startRaw, endRaw] = offset.split(":");
      start = +startRaw;
      end = +endRaw;
    } else {
      start = +offset;
      end = start;
    }
  }

  return new MagicMatchClause(resPattern, resMask, start, end);
};

interface Magic {
  priority: number;
  clause: Clause;
  type: string;
  extensions: string[];
}

const magics: Magic[] = parseMagics(rawMagics);

const detectContentType = (buffer: Uint8Array): string | undefined => {
  if (buffer.length === 0) {
    return undefined;
  }

  let result: string[] = [];

  let currentPriority = -1;
  for (const magic of magics) {
    if (currentPriority > 0 && currentPriority > magic.priority) {
      break;
    }
    if (magic.clause.eval(buffer)) {
      if (currentPriority === magic.priority) {
        result.push(magic.type);
      } else {
        // clear lower priority matches
        result = [magic.type];
        currentPriority = magic.priority;
      }
    }
  }

  if (result.length > 0) {
    return result[0];
  }

  return undefined;
};

export { detectContentType };
