import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { matchHotkey } from "../../src/hotkeys/matchHotkey.js";
import type { HotkeyBinding } from "../../src/hotkeys/types.js";

const createBinding = (partial: Partial<HotkeyBinding> & Pick<HotkeyBinding, "key">): HotkeyBinding => ({
  id: "test",
  scope: "global",
  handler: () => undefined,
  ...partial,
});

const createKeyboardEvent = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("hotkeys > matchHotkey", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("matches single-letter keys case-insensitively", () => {
    const binding = createBinding({ key: "j" });
    const event = createKeyboardEvent({ key: "J" });

    expect(matchHotkey(event, binding)).toBe(true);
  });

  test("matches arrow keys", () => {
    const binding = createBinding({ key: "ArrowDown" });
    const event = createKeyboardEvent({ key: "ArrowDown" });

    expect(matchHotkey(event, binding)).toBe(true);
  });

  test("requires modifiers when specified", () => {
    const binding = createBinding({ key: "\\", modifiers: { ctrl: true } });
    const withoutCtrl = createKeyboardEvent({ key: "\\" });
    const withCtrl = createKeyboardEvent({ key: "\\", ctrlKey: true });

    expect(matchHotkey(withoutCtrl, binding)).toBe(false);
    expect(matchHotkey(withCtrl, binding)).toBe(true);
  });

  test("matches ctrlOrMeta modifier on mac or windows", () => {
    const binding = createBinding({ key: "\\", code: "Backslash", modifiers: { ctrlOrMeta: true } });
    const withCtrl = createKeyboardEvent({ code: "Backslash", ctrlKey: true });
    const withMeta = createKeyboardEvent({ code: "Backslash", metaKey: true });

    expect(matchHotkey(withCtrl, binding)).toBe(true);
    expect(matchHotkey(withMeta, binding)).toBe(true);
  });

  test("matches physical key code when provided", () => {
    const binding = createBinding({ key: "[", code: "BracketLeft" });
    const event = createKeyboardEvent({ key: "х", code: "BracketLeft" });

    expect(matchHotkey(event, binding)).toBe(true);
  });

  test("matches space key", () => {
    const binding = createBinding({ key: " " });
    const event = createKeyboardEvent({ key: " " });

    expect(matchHotkey(event, binding)).toBe(true);
  });
});
