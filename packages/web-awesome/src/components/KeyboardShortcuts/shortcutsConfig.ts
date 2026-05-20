import { formatHotkey, type HotkeyBinding } from "@allurereport/web-commons";

export type ShortcutGroupId = "global" | "tree" | "testResult";

export type ShortcutItem = {
  binding: Pick<HotkeyBinding, "key" | "code" | "modifiers">;
  labelKey: string;
};

export type ShortcutGroup = {
  id: ShortcutGroupId;
  titleKey: string;
  items: ShortcutItem[];
};

export const shortcutGroups: ShortcutGroup[] = [
  {
    id: "global",
    titleKey: "groups.global",
    items: [
      { binding: { key: "?", code: "Slash", modifiers: { shift: true } }, labelKey: "items.toggleHelp" },
      { binding: { key: "s", code: "KeyS" }, labelKey: "items.focusSearch" },
      { binding: { key: "Escape" }, labelKey: "items.blurSearch" },
      { binding: { key: "[", code: "BracketLeft" }, labelKey: "items.focusTree" },
      { binding: { key: "]", code: "BracketRight" }, labelKey: "items.focusTestResult" },
      { binding: { key: "l", code: "KeyL", modifiers: { shift: true } }, labelKey: "items.toggleLayout" },
      { binding: { key: "\\", code: "Backslash", modifiers: { ctrlOrMeta: true } }, labelKey: "items.toggleLayoutAlt" },
      { binding: { key: "1" }, labelKey: "items.reportTabResults" },
      { binding: { key: "2" }, labelKey: "items.reportTabCategories" },
      { binding: { key: "3" }, labelKey: "items.reportTabQualityGate" },
      { binding: { key: "4" }, labelKey: "items.reportTabGlobalAttachments" },
      { binding: { key: "5" }, labelKey: "items.reportTabGlobalErrors" },
      { binding: { key: "Tab" }, labelKey: "items.reportTabNext" },
      { binding: { key: "Tab", modifiers: { shift: true } }, labelKey: "items.reportTabPrev" },
    ],
  },
  {
    id: "tree",
    titleKey: "groups.tree",
    items: [
      { binding: { key: "j", code: "KeyJ" }, labelKey: "items.moveDown" },
      { binding: { key: "k", code: "KeyK" }, labelKey: "items.moveUp" },
      { binding: { key: "h", code: "KeyH" }, labelKey: "items.collapse" },
      { binding: { key: "l", code: "KeyL" }, labelKey: "items.expand" },
      { binding: { key: "p", code: "KeyP" }, labelKey: "items.parent" },
      { binding: { key: "u", code: "KeyU" }, labelKey: "items.parentAlt" },
      { binding: { key: "o", code: "KeyO" }, labelKey: "items.openNode" },
      { binding: { key: "-", code: "Minus" }, labelKey: "items.collapseNode" },
      { binding: { key: "+", code: "Equal", modifiers: { shift: true } }, labelKey: "items.expandNode" },
      { binding: { key: "C", code: "KeyC" }, labelKey: "items.collapseAll" },
      { binding: { key: "A", code: "KeyA" }, labelKey: "items.expandAll" },
      { binding: { key: ">", code: "Period", modifiers: { shift: true } }, labelKey: "items.subtreeCycle" },
      { binding: { key: "C", code: "KeyC", modifiers: { shift: true } }, labelKey: "items.subtreeCollapse" },
      { binding: { key: "f", code: "KeyF" }, labelKey: "items.subtreeFirstLevel" },
      { binding: { key: "A", code: "KeyA", modifiers: { shift: true } }, labelKey: "items.subtreeExpand" },
      { binding: { key: " " }, labelKey: "items.toggleNode" },
      { binding: { key: "Enter" }, labelKey: "items.openTest" },
      { binding: { key: "g" }, labelKey: "items.firstTest" },
      { binding: { key: "G", modifiers: { shift: true } }, labelKey: "items.lastTest" },
      { binding: { key: "Home" }, labelKey: "items.treeTop" },
      { binding: { key: "z", code: "KeyZ" }, labelKey: "items.scrollTreeTop" },
      { binding: { key: "V", code: "KeyV" }, labelKey: "items.toggleReportVariables" },
      { binding: { key: "M", code: "KeyM" }, labelKey: "items.toggleReportMetadata" },
    ],
  },
  {
    id: "testResult",
    titleKey: "groups.testResult",
    items: [
      { binding: { key: "n", code: "KeyN" }, labelKey: "items.nextTest" },
      { binding: { key: "ArrowDown" }, labelKey: "items.nextTest" },
      { binding: { key: "j", code: "KeyJ" }, labelKey: "items.nextTest" },
      { binding: { key: "N", code: "KeyN", modifiers: { shift: true } }, labelKey: "items.prevTest" },
      { binding: { key: "ArrowUp" }, labelKey: "items.prevTest" },
      { binding: { key: "k", code: "KeyK" }, labelKey: "items.prevTest" },
      { binding: { key: "Tab" }, labelKey: "items.testTabNext" },
      { binding: { key: "Tab", modifiers: { shift: true } }, labelKey: "items.testTabPrev" },
      { binding: { key: "1" }, labelKey: "items.tabOverview" },
      { binding: { key: "2" }, labelKey: "items.tabHistory" },
      { binding: { key: "3" }, labelKey: "items.tabRetries" },
      { binding: { key: "4" }, labelKey: "items.tabAttachments" },
      { binding: { key: "5" }, labelKey: "items.tabEnvironments" },
      { binding: { key: "l", code: "KeyL" }, labelKey: "items.toggleLabels" },
      { binding: { key: "p", code: "KeyP" }, labelKey: "items.toggleParameters" },
      { binding: { key: "i", code: "KeyI" }, labelKey: "items.toggleLinks" },
      { binding: { key: "Escape" }, labelKey: "items.backToTree" },
    ],
  },
];

export const formatShortcut = (binding: Pick<HotkeyBinding, "key" | "code" | "modifiers">) => formatHotkey(binding);
