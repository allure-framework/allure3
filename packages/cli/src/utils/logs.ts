import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LOGS_DIRECTORY = join(homedir(), ".allure", "logs");

/**
 * Return the name of the today log file
 */
export const getLogFileName = () => `${new Date().toISOString().replace(/:/g, "-")}.log`;

/**
 * Read the today logs
 */
export const readLogs = async () => {
  await mkdir(LOGS_DIRECTORY, { recursive: true });

  const logFilePath = join(LOGS_DIRECTORY, getLogFileName());

  try {
    const logs = await readFile(logFilePath, "utf-8");

    return logs;
  } catch (err) {
    return "";
  }
};

/**
 * Log an error to the logs file
 * Returns the path to the logs file
 */
export const logError = async (message: string, trace?: string) => {
  let logs = await readLogs();

  if (!logs) {
    logs += `${new Date().toISOString()}[ERROR] ${message}\n`;
  } else {
    logs += `\n${new Date().toISOString()}[ERROR] ${message}\n`;
  }

  if (trace) {
    logs += `${trace}\n`;
  }

  const logFilePath = join(LOGS_DIRECTORY, getLogFileName());

  await writeFile(logFilePath, logs, "utf-8");

  return logFilePath;
};
