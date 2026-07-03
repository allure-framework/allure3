import { epic, feature, label, story } from "allure-js-commons";

import type { LogRecord } from "../src/record.js";
import type { Transport } from "../src/transport.js";

export const applyLoggerMetadata = async (storyName: string): Promise<void> => {
  await epic("coverage");
  await feature("logger");
  await story(storyName);
  await label("module", "logger");
};

export const createCaptureTransport = () => {
  const lines: string[] = [];
  const records: LogRecord[] = [];

  const transport: Transport = (line, record) => {
    lines.push(line);
    records.push(record);
  };

  return { lines, records, transport };
};
