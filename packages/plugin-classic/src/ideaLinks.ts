import type { TestLabel, TestLink } from "@allurereport/core-api";

import type { IdeaLinksOptions } from "./model.js";

// dot-separated identifiers only, so that suite names and other non-class values do not produce broken links
const javaClassNameRegexp = /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u;

export const createIdeaLink = (labels: TestLabel[], options: boolean | IdeaLinksOptions): TestLink[] => {
  const { port = 63342, fileExtension = "java", sourceRoot = "" } = options === true ? {} : options || {};
  const testClass = labels.find(({ name, value }) => name === "testClass" && value)?.value;
  // nested classes (`Outer$Inner`) live in the file of the outer class
  const classPath = testClass?.split("$")[0].replaceAll(".", "/");

  if (!testClass || !classPath || !javaClassNameRegexp.test(testClass)) {
    return [];
  }

  const root = sourceRoot.replace(/^\/+|\/+$/g, "");
  const file = `${root ? `${root}/` : ""}${classPath}.${fileExtension.replace(/^\./, "")}`;

  return [
    { name: "Open in IDEA", type: "idea", url: `http://localhost:${port}/api/file?file=${encodeURIComponent(file)}` },
  ];
};
