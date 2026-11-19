import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { type TimelineTr, groupTimelineByHost } from "../src/stores/timeline.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("timeline");
  await label("coverage", "ui-components");
});

const tr = (id: string, host: string, thread = "thread-1"): TimelineTr =>
  ({ id, name: id, status: "passed", host, thread, start: 1, duration: 1 }) as TimelineTr;

describe("groupTimelineByHost", () => {
  it("should group timeline items by host in order of first appearance", () => {
    const groups = groupTimelineByHost([tr("1", "b"), tr("2", "a"), tr("3", "b", "thread-2")]);

    expect(groups).toEqual([
      { host: "b", data: [tr("1", "b"), tr("3", "b", "thread-2")] },
      { host: "a", data: [tr("2", "a")] },
    ]);
  });

  it("should return no groups when there is no timeline data", () => {
    expect(groupTimelineByHost(undefined)).toEqual([]);
    expect(groupTimelineByHost([])).toEqual([]);
  });
});
