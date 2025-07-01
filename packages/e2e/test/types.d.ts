import type { FullConfig } from "@allurereport/core";

export type ReportConfig = Omit<FullConfig, "output" | "reportFiles" | "plugins" | "historyPath">;
