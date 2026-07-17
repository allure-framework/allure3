import { isEditableTarget } from "./isEditableTarget.js";
import { matchHotkey } from "./matchHotkey.js";
import type { HotkeyBinding, HotkeyScope } from "./types.js";

export type HotkeyControllerOptions = {
  getActiveScope: () => HotkeyScope;
  getEnabled: () => boolean;
  /** When false, bindings for the active scope are ignored (global bindings still work). */
  isScopeActive?: (scope: HotkeyScope) => boolean;
  bindings: HotkeyBinding[];
  /** Prevent default browser action (e.g. page scroll) before matching bindings. */
  shouldSuppressDefault?: (event: KeyboardEvent, activeScope: HotkeyScope) => boolean;
};

const getBindingScopes = (binding: HotkeyBinding): HotkeyScope[] =>
  Array.isArray(binding.scope) ? [...binding.scope] : ([binding.scope] as HotkeyScope[]);

const bindingMatchesScope = (binding: HotkeyBinding, activeScope: HotkeyScope): boolean => {
  const scopes = getBindingScopes(binding);

  if (scopes.includes("global")) {
    return true;
  }

  return scopes.includes(activeScope);
};

const runBinding = (event: KeyboardEvent, binding: HotkeyBinding, activeScope: HotkeyScope) => {
  if (!bindingMatchesScope(binding, activeScope)) {
    return false;
  }

  if (!matchHotkey(event, binding)) {
    return false;
  }

  if (binding.preventDefault !== false) {
    event.preventDefault();
  }

  if (binding.stopPropagation) {
    event.stopPropagation();
  }

  binding.handler(event);
  return true;
};

export const createHotkeyController = (options: HotkeyControllerOptions) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!options.getEnabled()) {
      return;
    }

    if (event.isComposing) {
      return;
    }

    const activeScope = options.getActiveScope();

    if (isEditableTarget(event.target)) {
      const editableBindings = options.bindings.filter((binding) => binding.allowInEditable);
      const scopedEditable = editableBindings.filter((binding) => {
        const scopes = getBindingScopes(binding);

        return scopes.includes(activeScope) && !scopes.every((scope) => scope === "global");
      });
      const globalEditable = editableBindings.filter((binding) => getBindingScopes(binding).includes("global"));

      for (const binding of [...scopedEditable, ...globalEditable]) {
        if (runBinding(event, binding, activeScope)) {
          return;
        }
      }

      return;
    }
    const scopeActive = options.isScopeActive?.(activeScope) ?? true;

    if (options.shouldSuppressDefault?.(event, activeScope) && scopeActive) {
      event.preventDefault();
    }
    const scopedBindings = scopeActive
      ? options.bindings.filter((binding) => {
          const scopes = getBindingScopes(binding);

          return scopes.includes(activeScope) && !scopes.every((scope) => scope === "global");
        })
      : [];
    const globalBindings = options.bindings.filter((binding) => getBindingScopes(binding).includes("global"));

    for (const binding of [...scopedBindings, ...globalBindings]) {
      if (runBinding(event, binding, activeScope)) {
        return;
      }
    }
  };

  const attach = () => {
    document.addEventListener("keydown", handleKeyDown, { capture: true });
  };

  const detach = () => {
    document.removeEventListener("keydown", handleKeyDown, { capture: true });
  };

  return { attach, detach };
};
