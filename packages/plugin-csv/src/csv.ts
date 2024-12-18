import type { CsvField, CsvOptions } from "./model.js";

export const generateCsv = async <T>(
  rows: T[],
  fields: CsvField<T>[],
  sort: (a: T, b: T) => number = () => 0,
  filter: (a: T) => boolean = () => true,
  options: CsvOptions = {},
): Promise<string> => {
  const { disableHeaders = false, separator = "," } = options;
  const content = [...rows]
    .filter(filter)
    .sort(sort)
    .map((tr) => {
      return fields
        .map(({ accessor }) => (typeof accessor === "function" ? accessor(tr) : tr[accessor]))
        .map(forceEscapeCsv)
        .join(separator);
    })
    .join("\n");

  const header = disableHeaders ? "" : `${fields.map((f) => f.header).join(separator)}\n`;
  return header + content;
};

const forceEscapeCsv = (value: any): string => {
  // eslint-disable-next-line prefer-template
  return value ? '"' + `${value}`.replaceAll('"', '""') + '"' : "";
};
