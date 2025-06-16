import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { red } from "yoctocolors";

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
 * Write the given error to the logs file and prints the given message to the console
 * @param message The message to print to the console
 * @param error The error to write to the logs file
 */
export const logError = async (message: string, error: Error) => {
  let logs = await readLogs();

  if (!logs) {
    logs += `${new Date().toISOString()}[ERROR] ${error.message}\n`;
  } else {
    logs += `\n${new Date().toISOString()}[ERROR] ${error.message}\n`;
  }

  if (error.stack) {
    logs += `${error.stack}\n`;
  }

  const logFilePath = join(LOGS_DIRECTORY, getLogFileName());

  await writeFile(logFilePath, logs, "utf-8");

  // eslint-disable-next-line no-console
  console.error(red(`${message}. Check logs for more details: ${logFilePath}`));
};
