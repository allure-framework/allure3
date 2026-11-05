import { Option } from "clipanion";
import { isEnum } from "typanion";

const OUTPUT_ENCODINGS = [
  "ascii",
  "utf8",
  "utf-8",
  "utf16le",
  "utf-16le",
  "ucs2",
  "ucs-2",
  "base64",
  "base64url",
  "latin1",
  "binary",
  "hex",
] as const satisfies readonly BufferEncoding[];

export const outputEncodingOption = () =>
  Option.String("--output-encoding", {
    description: "Encoding of the application's stdout and stderr",
    validator: isEnum(OUTPUT_ENCODINGS),
  });

export const stderrEncodingOption = () =>
  Option.String("--stderr-encoding", {
    description: "Encoding of the application's stderr. Overrides --output-encoding for stderr",
    validator: isEnum(OUTPUT_ENCODINGS),
  });
