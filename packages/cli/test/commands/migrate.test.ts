import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MigrateCommand } from "../../src/commands/migrate.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("migrate");
  await label("coverage", "cli-commands");
});

describe("migrate command", () => {
  it("prints the Allure 2 to Allure 3 command mapping", async () => {
    const stdout = { write: vi.fn() };

    const code = await run(MigrateCommand, ["migrate"], {
      stdout: stdout as unknown as NodeJS.WritableStream,
    });
    const output = stdout.write.mock.calls.map(([chunk]) => String(chunk)).join("");

    expect(code).toBe(0);
    expect(output).toContain("Allure 2 -> Allure 3");
    expect(output).toContain("allure serve <results>");
    expect(output).toContain("allure open <results>");
  });
});
