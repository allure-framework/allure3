import process from "node:process";

import { epic, feature, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { JobMonitor } from "../../../src/utils/supervisor/model.js";
import { ProcessSupervisorBase } from "../../../src/utils/supervisor/ProcessSupervisorBase.js";

class TestProcessSupervisor extends ProcessSupervisorBase {
  protected readonly shell = false;
  protected readonly detached = false;
  protected readonly monitor: JobMonitor = {
    wait: async () => undefined,
  };

  readonly requestGracefulStop = vi.fn();
  readonly requestForcedTermination = vi.fn();

  constructor() {
    super(process.execPath, { arguments: ["-e", ""], outputMode: "ignore" });
  }

  protected getStartupInfo() {
    const pid = this.process.pid;
    return pid === undefined ? undefined : { pid };
  }
}

describe("Process supervisor completion", () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("process-supervisor");
  });

  it.each(["stop", "stop with escalation", "terminate"] as const)(
    "%s after completion does not request graceful stop or forced termination",
    async (operation) => {
      const supervisor = new TestProcessSupervisor();
      await supervisor.start();
      await expect(supervisor.completion).resolves.toMatchObject({ code: 0, signal: null });
      expect(supervisor.completed).toBe(true);

      const result =
        operation === "terminate"
          ? supervisor.terminate()
          : operation === "stop with escalation"
            ? supervisor.stop({ escalate: true })
            : supervisor.stop();

      await expect(result).resolves.toBeUndefined();
      expect(supervisor.requestGracefulStop).not.toHaveBeenCalled();
      expect(supervisor.requestForcedTermination).not.toHaveBeenCalled();
    },
  );
});
