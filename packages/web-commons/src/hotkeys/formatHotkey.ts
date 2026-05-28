import type { HotkeyBinding } from "./types.js";

const isMacOs = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.getAttribute("data-os") === "mac";
};

const formatModifier = (key: string, macSymbol: string, winLabel: string): string => {
  return isMacOs() ? macSymbol : winLabel;
};

export const formatHotkey = (binding: Pick<HotkeyBinding, "key" | "modifiers">): string => {
  const modifiers = binding.modifiers ?? {};
  const parts: string[] = [];

  if (modifiers.meta) {
    parts.push(formatModifier("meta", "⌘", "Ctrl"));
  }

  if (modifiers.ctrlOrMeta) {
    parts.push(formatModifier("ctrlOrMeta", "⌘", "Ctrl"));
  } else if (modifiers.ctrl) {
    parts.push(formatModifier("ctrl", "⌃", "Ctrl"));
  }

  if (modifiers.alt) {
    parts.push(formatModifier("alt", "⌥", "Alt"));
  }

  if (modifiers.shift) {
    parts.push(formatModifier("shift", "⇧", "Shift"));
  }

  const keyLabel = binding.key === " " ? "Space" : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;

  parts.push(keyLabel);

  return parts.join(isMacOs() ? "" : " + ");
};
