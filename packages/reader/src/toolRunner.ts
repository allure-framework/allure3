import { spawn } from "node:child_process";
import type { Unknown } from "./validation.js";

const LINE_SPLIT_PATTERN = /\r\n|\r|\n/;

export type ProcessRunOptions = {
  exitCode?: number | ((code: number) => boolean);
  encoding?: BufferEncoding;
  timeout?: number;
  timeoutSignal?: NodeJS.Signals;
  ignoreStderr?: boolean;
};

export const invokeCliTool = async (
  executable: string,
  args: readonly string[],
  { timeout, timeoutSignal, ignoreStderr, encoding, exitCode: expectedExitCode = 0 }: ProcessRunOptions = {},
) => {
  const toolProcess = spawn(executable, args, {
    stdio: ["ignore", "ignore", ignoreStderr ? "ignore" : "pipe"],
    shell: false,
    timeout: timeout,
    killSignal: timeoutSignal,
  });

  const stderr: string[] = [];

  if (!ignoreStderr) {
    toolProcess.stderr?.setEncoding(encoding ?? "utf-8").on("data", (chunk) => stderr.push(String(chunk)));
  }

  let onSuccess: () => void;
  let onError: (e: Error) => void;

  const resultPromise = new Promise<void>((resolve, reject) => {
    onSuccess = resolve;
    onError = reject;
  });

  toolProcess.on("exit", (code, signal) => {
    if (signal) {
      onError(
        new Error(
          timeout && toolProcess.killed
            ? `${executable} was terminated by timeout (${timeout} ms)`
            : `${executable} was terminated with ${signal}`,
        ),
      );
      return;
    }

    if (typeof expectedExitCode === "number" ? code !== expectedExitCode : expectedExitCode(code!)) {
      onError(new Error(`${executable} finished with an unexpected exit code ${code}`));
      return;
    }

    onSuccess();
  });

  return await resultPromise;
};

export const invokeStdoutCliTool = async function* (
  executable: string,
  args: readonly string[],
  { timeout, timeoutSignal, encoding, exitCode: expectedExitCode = 0, ignoreStderr }: ProcessRunOptions = {},
) {
  const emitChunk = (chunk: string) => {
    const lines = (unfinishedLineBuffer + chunk).split(LINE_SPLIT_PATTERN);
    if (lines.length) {
      unfinishedLineBuffer = lines.at(-1)!;
      bufferedLines.push(...lines.slice(0, -1));
      maybeContinueConsumption();
    }
  };

  const emitFinalChunk = () => {
    if (unfinishedLineBuffer) {
      bufferedLines.push(unfinishedLineBuffer);
      unfinishedLineBuffer = "";
      maybeContinueConsumption();
    }
  };

  const emitError = (message: string) => {
    if (stderr.length) {
      message = `${message}\n\nStandard error:\n\n${stderr.join("\n")}`;
    }
    bufferedError = new Error(message);
    maybeContinueConsumption();
  };

  const checkExitCode = (code: number) => {
    if (typeof expectedExitCode === "number") {
      return code === expectedExitCode;
    }

    return expectedExitCode(code);
  };

  const maybeContinueConsumption = () => {
    if (continueConsumption) {
      const continueConsumptionLocal = continueConsumption;
      continueConsumption = undefined;
      continueConsumptionLocal();
    }
  };

  const stdIoEncoding = encoding ?? "utf-8";
  const bufferedLines: string[] = [];
  let unfinishedLineBuffer = "";
  let done = false;
  let bufferedError: Error | undefined;

  const stderr: string[] = [];

  let continueConsumption: (() => void) | undefined;

  const toolProcess = spawn(executable, args, {
    stdio: ["ignore", "pipe", ignoreStderr ? "ignore" : "pipe"],
    shell: false,
    timeout,
    killSignal: timeoutSignal,
  });

  toolProcess.stdout?.setEncoding(stdIoEncoding).on("data", (chunk) => {
    emitChunk(String(chunk));
  });

  toolProcess.stderr?.setEncoding(stdIoEncoding).on("data", (chunk) => {
    stderr.push(String(chunk));
  });

  toolProcess.on("exit", (code, signal) => {
    emitFinalChunk();

    done = true;

    if (bufferedError) {
      return;
    }

    if (signal) {
      emitError(
        timeout && toolProcess.killed
          ? `${executable} was terminated by timeout (${timeout} ms)`
          : `${executable} was terminated with ${signal}`,
      );
      return;
    }

    if (!checkExitCode(code!)) {
      emitError(`${executable} finished with an unexpected exit code ${code}`);
      return;
    }

    continueConsumption?.();
  });

  while (true) {
    if (bufferedLines.length) {
      yield* bufferedLines;
      bufferedLines.splice(0);
    }

    if (bufferedError) {
      throw bufferedError;
    }

    if (done) {
      return;
    }

    await new Promise<void>((resolve) => {
      continueConsumption = resolve;
    });
  }
};

export const invokeJsonCliTool = async <T>(
  tool: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
): Promise<Unknown<T>> => {
  const lines: string[] = [];
  for await (const line of invokeStdoutCliTool(tool, args, options)) {
    lines.push(line);
  }
  return JSON.parse(lines.join(""));
};
