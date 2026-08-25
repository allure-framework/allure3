import { describe, expect, it, vi } from "vitest";

import { allureResultsDirectoriesGlobWatcher } from "../../../src/commands/commons/resultsDiscovery.js";

const { watchMock, differenceMock, findDirectoriesByGlobsMock } = vi.hoisted(() => ({
  watchMock: vi.fn((initial: () => Promise<void>) => {
    void initial();
    return {
      initialScan: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      watchEnd: vi.fn().mockResolvedValue(undefined),
    };
  }),
  differenceMock: vi.fn((before: Set<string>, after: Set<string>) => {
    const added = new Set<string>();
    const deleted = new Set(before);

    for (const value of after) {
      if (!deleted.has(value)) {
        added.add(value);
      } else {
        deleted.delete(value);
      }
    }

    return [added, deleted];
  }),
  findDirectoriesByGlobsMock: vi.fn(),
}));

vi.mock("@allurereport/directory-watcher", () => ({
  watch: watchMock,
  difference: differenceMock,
}));

vi.mock("../../../src/utils/fileSystem.js", () => ({
  findDirectoriesByGlobs: findDirectoriesByGlobsMock,
}));

describe("allureResultsDirectoriesGlobWatcher", () => {
  it("reports directories that appear on a later poll", async () => {
    const updates: Array<{ added: string[]; deleted: string[] }> = [];

    findDirectoriesByGlobsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["/tmp/results/", "/tmp/other-results/"]);

    const watcher = allureResultsDirectoriesGlobWatcher("/cwd", ["./**/allure-results"], async (added, deleted) => {
      updates.push({ added: [...added].sort(), deleted: [...deleted] });
    });

    await watcher.initialScan();
    await (watchMock.mock.calls.at(-1)?.[1] as () => Promise<void>)();

    expect(updates[0]?.added).toEqual([]);
    expect(updates[1]?.added).toEqual(["/tmp/other-results/", "/tmp/results/"].sort());
    expect(updates[1]?.deleted).toEqual([]);
  });
});
