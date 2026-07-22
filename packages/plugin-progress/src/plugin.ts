import * as process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import type { WriteStream } from "node:tty";

import type { AllureStore, Plugin, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import { green, red, yellow } from "yoctocolors";

import { Terminal } from "./terminal.js";

const DEFAULT_MIN_RENDER_INTERVAL_MS = 300;

export class ProgressPlugin implements Plugin {
  readonly #terminal?: Terminal;
  readonly #minRenderIntervalMs: number;
  #lastRenderAt = 0;
  #pendingStore: AllureStore | undefined;
  #pumping = false;
  #pumpDone: Promise<void> = Promise.resolve();

  constructor(readonly options: { stream?: WriteStream; minRenderIntervalMs?: number } = {}) {
    const { stream = process.stdout, minRenderIntervalMs = DEFAULT_MIN_RENDER_INTERVAL_MS } = this.options;
    if (stream) {
      this.#terminal = new Terminal(stream);
    }
    this.#minRenderIntervalMs = minRenderIntervalMs;
  }

  start = async (context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void> => {
    realtime.onTestResults(async () => {
      this.#pendingStore = store;

      if (!this.#pumping) {
        this.#pumpDone = this.#pump();
      }
    });
  };

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    // wait for any in-flight render to settle first, so we never write concurrently with it and
    // corrupt the in-place line, then force one final, unthrottled render so the last numbers
    // shown are always accurate, even if they arrived inside the throttling window.
    await this.#pumpDone;
    await this.#render(store);

    // commit the in-place line so it doesn't end up glued to whatever gets printed after us
    // (the shell prompt, another log line, etc.), then stop intercepting the stream — we're not
    // rendering anything else.
    if (this.#terminal?.isTTY()) {
      this.#terminal.newline();
    }

    this.#terminal?.detach();
  };

  // results come in bursts (a single test run can report dozens of results within milliseconds).
  // rendering on every single one is what floods non-TTY output (piped logs, CI, IDE panels) with
  // thousands of near-duplicate lines, and on a real terminal a new render can start before the
  // previous one finishes writing, corrupting the cursor-controlled block. This pump guarantees at
  // most one #render in flight at a time, spaced at least #minRenderIntervalMs apart, always using
  // the latest available stats.
  #pump = async (): Promise<void> => {
    this.#pumping = true;

    try {
      while (this.#pendingStore) {
        const elapsed = Date.now() - this.#lastRenderAt;
        const wait = Math.max(0, this.#minRenderIntervalMs - elapsed);

        if (wait > 0) {
          await delay(wait);
        }

        const store = this.#pendingStore;

        this.#pendingStore = undefined;
        this.#lastRenderAt = Date.now();

        await this.#render(store);
      }
    } finally {
      this.#pumping = false;
    }
  };

  #render = async (store: AllureStore) => {
    if (!this.#terminal) {
      return;
    }

    const testsStatistic = await store.testsStatistic();
    const parts = [
      testsStatistic.failed ? `${red("failed")}: ${testsStatistic.failed}` : undefined,
      testsStatistic.broken ? `${yellow("broken")}: ${testsStatistic.broken}` : undefined,
      testsStatistic.passed ? `${green("passed")}: ${testsStatistic.passed}` : undefined,
      `total: ${testsStatistic.total}`,
    ].filter((part): part is string => !!part);
    const line = parts.join("  ");

    if (!this.#terminal.isTTY()) {
      // one line per update; can't be redrawn in place without a real terminal.
      this.#terminal.write(line);
      this.#terminal.newline();
      return;
    }

    // Redraw a single line in place instead of a multi-row block. A multi-row block needs to
    // remember how many rows it occupies to move the cursor back up before the next redraw, and
    // that bookkeeping desyncs the moment *anything else* writes to the same stream between
    // renders (another plugin's log line, etc.) — the cursor ends up a different number of rows
    // away than expected, and the block starts drifting/duplicating instead of overwriting.
    // Resetting to column 0 of whatever the current row is has no such state to get out of sync.
    this.#terminal.cursorTo(0);
    this.#terminal.clearLine();
    this.#terminal.write(line);
  };
}
