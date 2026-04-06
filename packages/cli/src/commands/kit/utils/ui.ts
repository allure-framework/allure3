import * as console from "node:console";

import colors from "yoctocolors";

export const logSuccess = (message: string): void => {
  console.log(colors.green(`  ✓ ${message}`));
};

export const logInfo = (message: string): void => {
  console.log(colors.cyan(`  ℹ ${message}`));
};

export const logWarning = (message: string): void => {
  console.log(colors.yellow(`  ⚠ ${message}`));
};

export const logError = (message: string): void => {
  console.log(colors.red(`  ✗ ${message}`));
};

export const logStep = (message: string): void => {
  console.log(colors.bold(`\n  ${message}`));
};

export const logHint = (message: string): void => {
  console.log(colors.dim(`    ${message}`));
};

export const logNewLine = (): void => {
  console.log();
};
