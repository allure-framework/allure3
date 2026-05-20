import type { HotkeyBinding } from "./types.js";

const normalizeKey = (key: string): string => {
  if (key === " ") {
    return " ";
  }

  if (key.length === 1) {
    return key.toLowerCase();
  }

  return key;
};

const eventKey = (event: KeyboardEvent): string => normalizeKey(event.key);

export const matchHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  const modifiers = binding.modifiers ?? {};
  const expectsCtrl = Boolean(modifiers.ctrl);
  const expectsShift = Boolean(modifiers.shift);
  const expectsAlt = Boolean(modifiers.alt);
  const expectsMeta = Boolean(modifiers.meta);
  const expectsCtrlOrMeta = Boolean(modifiers.ctrlOrMeta);

  if (expectsCtrlOrMeta) {
    if (!event.ctrlKey && !event.metaKey) {
      return false;
    }
  } else {
    if (event.ctrlKey !== expectsCtrl) {
      return false;
    }

    if (event.metaKey !== expectsMeta) {
      return false;
    }
  }

  if (event.shiftKey !== expectsShift) {
    return false;
  }

  if (event.altKey !== expectsAlt) {
    return false;
  }

  if (binding.code) {
    return event.code === binding.code;
  }

  return eventKey(event) === normalizeKey(binding.key);
};
