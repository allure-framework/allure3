import type { HistoryTestResult } from "@allurereport/core-api";

export const isNew = (history: HistoryTestResult[] = []) => history.length === 0;
