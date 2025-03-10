import { spawn } from "node:child_process";
import type { Unknown } from "./validation.js";

const LINE_SPLIT_PATTERN = /\r\n|\r|\n/;

export type ProcessRunOptions = {
  exitCode?: number | ((code: number) => boolean);
  encoding?: BufferEncoding;
  stderrEncoding?: BufferEncoding;
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

type ResolveCliOutput<T> = T extends { encoding: BufferEncoding } ? string : Buffer;

export const invokeStdoutCliTool = async function* <T extends ProcessRunOptions | undefined>(
  executable: string,
  args: readonly string[],
  options?: T,
): AsyncGenerator<ResolveCliOutput<T>, void, unknown> {
  const {
    timeout,
    timeoutSignal,
    encoding,
    stderrEncoding,
    exitCode: expectedExitCode = 0,
    ignoreStderr,
  } = options ?? {};
  const emitTextChunk = (chunk: string) => {
    const lines = (unfinishedLineBuffer + chunk).split(LINE_SPLIT_PATTERN);
    if (lines.length) {
      unfinishedLineBuffer = lines.at(-1)!;
      stdoutChunks.push(...(lines.slice(0, -1) as ResolveCliOutput<T>[]));
      maybeContinueConsumption();
    }
  };

  const emitFinalTextChunk = () => {
    if (unfinishedLineBuffer) {
      stdoutChunks.push(unfinishedLineBuffer as ResolveCliOutput<T>);
      unfinishedLineBuffer = "";
      maybeContinueConsumption();
    }
  };

  const emitBinaryChunk = (chunk: Buffer) => {
    stdoutChunks.push(chunk as ResolveCliOutput<T>);
    maybeContinueConsumption();
  };

  const emitError = (message: string) => {
    if (stderrChunks.length) {
      message = `${message}\n\nStandard error:\n\n${stderrChunks.join("")}`;
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

  const stdoutChunks: ResolveCliOutput<T>[] = [];
  let unfinishedLineBuffer = "";
  let done = false;
  let bufferedError: Error | undefined;

  const stderrChunks: string[] = [];

  let continueConsumption: (() => void) | undefined;

  const toolProcess = spawn(executable, args, {
    stdio: ["ignore", "pipe", ignoreStderr ? "ignore" : "pipe"],
    shell: false,
    timeout,
    killSignal: timeoutSignal,
  });

  const { stdout, stderr } = toolProcess;
  if (stdout) {
    if (encoding) {
      stdout.setEncoding(encoding).on("data", emitTextChunk);
    } else {
      stdout.on("data", emitBinaryChunk);
    }
  }

  if (stderr) {
    stderr.setEncoding(stderrEncoding ?? encoding ?? "utf-8").on("data", stderrChunks.push.bind(stderrChunks));
  }

  toolProcess.on("exit", (code, signal) => {
    emitFinalTextChunk();

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
    if (stdoutChunks.length) {
      yield* stdoutChunks;
      stdoutChunks.splice(0);
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

export const invokeTextStdoutCliTool = async function* (
  executable: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
) {
  yield* invokeStdoutCliTool(executable, args, { encoding: "utf-8", ...options });
};

export const invokeJsonCliTool = async <T>(
  tool: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
): Promise<Unknown<T>> => {
  const lines: string[] = [];
  for await (const line of invokeTextStdoutCliTool(tool, args, options)) {
    lines.push(line);
  }
  return JSON.parse(lines.join(""));
};
