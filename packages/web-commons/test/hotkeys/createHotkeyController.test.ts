import { describe, expect, it, vi } from "vitest";

import { createHotkeyController } from "../../src/hotkeys/createHotkeyController.js";
import type { HotkeyBinding } from "../../src/hotkeys/types.js";

describe("createHotkeyController", () => {
  it("suppresses default in capture phase before handlers", () => {
    const handler = vi.fn();
    const bindings: HotkeyBinding[] = [
      {
        id: "tree-down",
        scope: "tree",
        key: "ArrowDown",
        handler,
      },
    ];

    const controller = createHotkeyController({
      getActiveScope: () => "tree",
      getEnabled: () => true,
      bindings,
      shouldSuppressDefault: (event, scope) => scope === "tree" && event.key === "ArrowDown",
    });

    controller.attach();

    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);

    controller.detach();
  });

  it("ignores scoped bindings when scope is inactive", () => {
    const treeHandler = vi.fn();
    const globalHandler = vi.fn();

    const controller = createHotkeyController({
      getActiveScope: () => "tree",
      getEnabled: () => true,
      isScopeActive: (scope) => scope === "global",
      bindings: [
        { id: "tree", scope: "tree", key: "j", handler: treeHandler },
        { id: "global", scope: "global", key: "s", handler: globalHandler },
      ],
    });

    controller.attach();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));

    expect(treeHandler).not.toHaveBeenCalled();
    expect(globalHandler).toHaveBeenCalledTimes(1);

    controller.detach();
  });

  it("runs allowInEditable bindings when focus is in an input", () => {
    const handler = vi.fn();
    const input = document.createElement("input");

    document.body.append(input);
    input.focus();

    const controller = createHotkeyController({
      getActiveScope: () => "global",
      getEnabled: () => true,
      bindings: [
        {
          id: "blur",
          scope: "global",
          key: "Escape",
          allowInEditable: true,
          handler,
        },
      ],
    });

    controller.attach();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);

    controller.detach();
    input.remove();
  });
});
