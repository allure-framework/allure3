import * as process from "node:process";
import type { WriteStream } from "node:tty";

import type { AllureStore, Plugin, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";

import { ProgressConsolePresenter } from "./console.js";

export class ProgressPlugin implements Plugin {
  readonly #presenter?: ProgressConsolePresenter;

  constructor(readonly options: { stream?: WriteStream } = {}) {
    const { stream = process.stdout } = this.options;
    if (stream) {
      this.#presenter = new ProgressConsolePresenter({
        mode: "progress",
        stdout: stream,
        stderr: stream,
      });
    }
  }

  start = async (context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void> => {
    if (!this.#presenter) {
      return;
    }

    await this.#presenter.attach(store, realtime);
  };

  done = async (): Promise<void> => {
    this.#presenter?.dispose();
  };
}
