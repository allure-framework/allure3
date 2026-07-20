export const isReportDataFile = (filename: string) =>
  filename === "index.html" ||
  filename === "summary.json" ||
  filename.startsWith("data/") ||
  filename.startsWith("widgets/") ||
  filename.startsWith("history/");
