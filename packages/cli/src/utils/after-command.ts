import { isAbsolute, relative, resolve } from "node:path";

const quoteIfNeeded = (value: string): string => {
  return value.includes(" ") ? JSON.stringify(value) : value;
};

export const buildAllureOpenNextStepCommands = (params: {
  cwd: string;
  reportPath?: string;
}): { label?: string; command: string }[] => {
  const reportPath = params.reportPath && params.reportPath.length > 0 ? params.reportPath : "allure-report";
  const absoluteReportPath = isAbsolute(reportPath) ? reportPath : resolve(params.cwd, reportPath);
  const relativeReportPath = relative(params.cwd, absoluteReportPath) || ".";
  const normalizedRelative = relativeReportPath.startsWith(".") ? relativeReportPath : `./${relativeReportPath}`;

  const shortCommand =
    normalizedRelative === "./allure-report" || normalizedRelative === "allure-report"
      ? "allure open"
      : `allure open ${quoteIfNeeded(normalizedRelative)}`;

  return [{ command: shortCommand }];
};
