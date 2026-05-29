export type HotkeyScope = "global" | "tree" | "testResult";

export type HotkeyModifiers = {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  /** Match when either Ctrl (Win/Linux) or Meta/Cmd (macOS) is pressed. */
  ctrlOrMeta?: boolean;
};

export type HotkeyBinding = {
  id: string;
  scope: HotkeyScope | readonly HotkeyScope[];
  key: string;
  /** Physical key code (`KeyboardEvent.code`) for layout-independent matching. */
  code?: string;
  modifiers?: HotkeyModifiers;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  /** Run even when focus is in an input/textarea (e.g. Escape in search). */
  allowInEditable?: boolean;
};
