import type { AllureStore } from "@allurereport/core-api";
import type { Plugin, PluginContext, Realtime } from "@allurereport/plugin-api";
import * as process from "node:process";
import type { WriteStream } from "node:tty";
import { green, red, yellow } from "yoctocolors";
import { Terminal } from "./terminal.js";

export class ProgressPlugin implements Plugin {
  readonly #terminal?: Terminal;

  constructor(readonly options: { stream?: WriteStream } = {}) {
    const { stream = process.stdout } = this.options;
    if (stream) {
      this.#terminal = new Terminal(stream);
    }
  }

  start = async (context: PluginContext, store: AllureStore, realtime: Realtime): Promise<void> => {
    realtime.onTestResults(async () => {
      await this.#render(store);
    });
  };

  #render = async (store: AllureStore) => {
    if (!this.#terminal) {
      return;
    }
    this.#terminal.cursorRelativeReset();
    this.#terminal.clearLine();
    this.#terminal.clearBottom();

    const testsStatistic = await store.testsStatistic();
    if (testsStatistic.failed) {
      this.#terminal.write(`${red("failed")}: ${testsStatistic.failed}`);
      this.#terminal.newline();
    }
    if (testsStatistic.broken) {
      this.#terminal.write(`${yellow("broken")}: ${testsStatistic.broken}`);
      this.#terminal.newline();
    }
    if (testsStatistic.passed) {
      this.#terminal.write(`${green("passed")}: ${testsStatistic.passed}`);
      this.#terminal.newline();
    }
    this.#terminal.write(`total: ${testsStatistic.total}`);
  };
}
