import type { TestLabel, TestLink } from "@allurereport/core-api";

export type IdeaLinksOptions = {
  /** Port of the IDEA built-in server. Default: 63342 */
  port?: number;
  /** Extension of the test source file, with or without a leading dot. Default: "java" */
  fileExtension?: string;
  /** Path of the sources root relative to the project root, e.g. "src/test/java". Default: none */
  sourceRoot?: string;
};

// dot-separated identifiers only, so that suite names and other non-class values do not produce broken links
const javaClassNameRegexp = /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u;

const trimSlashes = (value: string) => {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;

  return value.slice(start, end);
};

export const createIdeaLink = (labels: TestLabel[], options: boolean | IdeaLinksOptions): TestLink[] => {
  const { port = 63342, fileExtension = "java", sourceRoot = "" } = options === true ? {} : options || {};
  const testClass = labels.find(({ name, value }) => name === "testClass" && value)?.value;
  // nested classes (`Outer$Inner`) live in the file of the outer class
  const classPath = testClass?.split("$")[0].replaceAll(".", "/");

  if (!testClass || !classPath || !javaClassNameRegexp.test(testClass)) {
    return [];
  }

  const root = trimSlashes(sourceRoot);
  const file = `${root ? `${root}/` : ""}${classPath}.${fileExtension.replace(/^\./, "")}`;

  return [
    { name: "Open in IDEA", type: "idea", url: `http://localhost:${port}/api/file?file=${encodeURIComponent(file)}` },
  ];
};
