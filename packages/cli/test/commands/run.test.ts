import { UsageError } from "clipanion";
import { describe, expect, it } from "vitest";

import { RunCommand } from "../../src/commands/run.js";

describe("run command", () => {
  it("should fail with usage error when command to run is missing", async () => {
    const command = new RunCommand();

    command.commandToRun = [];

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should fail with usage error for newline in --environment", async () => {
    const command = new RunCommand();

    command.commandToRun = ["--", "echo", "hi"];
    command.environment = "foo\nbar";

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });
});
