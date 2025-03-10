import type { TestResult } from "@allurereport/core-api";

export type CsvOptions = {
  separator?: string;
  disableHeaders?: boolean;
};

export type CsvField<T> = {
  header: string;
  accessor: keyof T | ((result: T) => string | undefined);
};

export type CsvPluginOptions = {
  fileName?: string;
  fields?: CsvField<TestResult>[];
  sort?: (a: TestResult, b: TestResult) => number;
  filter?: (a: TestResult) => boolean;
} & CsvOptions;
