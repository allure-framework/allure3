import { blue, bold, cyan } from "yoctocolors";

const noopUploadProgressBar = {
  tick: () => {},
  terminate: () => {},
};

const isSilentLogLevel = () => {
  const level = process.env.LOG_LEVEL ?? process.env.ALLURE_LOG_LEVEL;

  return level === "silent";
};

export const createUploadProgressBarCounter = (message: string, total: number) => {
  if (isSilentLogLevel() || total === 0 || !process.stderr.isTTY) {
    return noopUploadProgressBar;
  }

  const width = 20;
  const prefix = cyan(bold("[AllureReport]:"));
  let current = 0;
  let terminated = false;
  const render = () => {
    const ratio = total === 0 ? 1 : current / total;
    const complete = Math.min(width, Math.round(ratio * width));
    const bar = `${"=".repeat(complete)}${"-".repeat(width - complete)}`;

    process.stderr.write(`\r${prefix} ${blue(message)} [${bar}] ${current}/${total}`);
  };

  render();

  return {
    tick: () => {
      if (terminated) {
        return;
      }

      current = Math.min(current + 1, total);
      render();
    },
    terminate: () => {
      if (terminated) {
        return;
      }

      terminated = true;
      process.stderr.write("\n");
    },
  };
};
