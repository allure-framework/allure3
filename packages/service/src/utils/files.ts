export const isReportDataFile = (filename: string) =>
  filename === "index.html" ||
  filename === "summary.json" ||
  filename === "test-results.json" ||
  filename.startsWith("data/") ||
  filename.startsWith("widgets/") ||
  filename.startsWith("history/");
