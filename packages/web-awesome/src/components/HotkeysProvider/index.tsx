import { createHotkeyController, type HotkeyBinding, type HotkeyScope } from "@allurereport/web-commons";
import { useEffect } from "preact/hooks";

import {
  focusTreePane,
  hotkeysHelpOpen,
  isHotkeyScopeActive,
  isSearchInput,
  toggleHotkeysHelp,
} from "@/stores/keyboard";
import {
  applyTreeNavigation,
  collapseAllChildrenFromFocus,
  collapseFocusedSubtree,
  cycleFocusedSubtreeToggle,
  expandAllChildrenFromFocus,
  expandFocusedSubtree,
  expandFocusedSubtreeFirstLevel,
  blurSearch,
  focusSearch,
  focusTestResultPaneIfOpen,
  getHotkeyScope,
  cycleReportRootTabHotkey,
  cycleTestResultTabHotkey,
  goToNextTestResult,
  goToPrevTestResult,
  goToReportRootTab,
  goToTestResultTab,
  handleTestResultEscape,
  isHotkeysEnabled,
  navigateDownInTestResultPane,
  navigateUpInTestResultPane,
  openTestResultFromTree,
  openTreeNodeFromFocus,
  toggleMetadataSection,
  toggleReportEnvSection,
  toggleTreeNodeFromFocus,
} from "@/stores/keyboardActions";
import { toggleLayout } from "@/stores/layout";
import { REPORT_ROOT_TAB } from "@/stores/reportRootTabs";
import { TEST_RESULT_TAB } from "@/stores/testResultTabs";

const TREE_NAVIGATION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  " ",
  "-",
  "=",
  "+",
]);

const TREE_NAV_CODES = new Set([
  "KeyJ",
  "KeyK",
  "KeyH",
  "KeyL",
  "KeyP",
  "KeyU",
  "KeyO",
  "KeyA",
  "KeyC",
  "KeyF",
  "KeyZ",
  "KeyT",
  "Minus",
  "Equal",
]);

const TEST_RESULT_OVERVIEW_NAV_KEYS = new Set(["ArrowUp", "ArrowDown"]);

const TEST_RESULT_OVERVIEW_NAV_CODES = new Set(["KeyJ", "KeyK"]);

const shouldSuppressHotkeyScroll = (event: KeyboardEvent, activeScope: HotkeyScope): boolean => {
  if (
    activeScope === "tree" &&
    isHotkeyScopeActive("tree") &&
    (TREE_NAVIGATION_KEYS.has(event.key) || TREE_NAV_CODES.has(event.code))
  ) {
    return true;
  }

  return (
    activeScope === "testResult" &&
    isHotkeyScopeActive("testResult") &&
    (TEST_RESULT_OVERVIEW_NAV_KEYS.has(event.key) || TEST_RESULT_OVERVIEW_NAV_CODES.has(event.code))
  );
};

const createBindings = (): HotkeyBinding[] => [
  {
    id: "toggle-help",
    scope: "global",
    key: "?",
    code: "Slash",
    modifiers: { shift: true },
    handler: () => toggleHotkeysHelp(),
  },
  {
    id: "blur-search",
    scope: "global",
    key: "Escape",
    allowInEditable: true,
    handler: () => {
      if (!isSearchInput(document.activeElement)) {
        return;
      }

      if (hotkeysHelpOpen.value) {
        hotkeysHelpOpen.value = false;
        return;
      }

      blurSearch();
    },
  },
  {
    id: "escape",
    scope: ["global", "tree", "testResult"],
    key: "Escape",
    handler: () => {
      if (hotkeysHelpOpen.value) {
        hotkeysHelpOpen.value = false;
        return;
      }

      if (getHotkeyScope() === "testResult") {
        handleTestResultEscape();
      }
    },
    preventDefault: false,
  },
  {
    id: "focus-search",
    scope: "global",
    key: "s",
    code: "KeyS",
    handler: () => focusSearch(),
  },
  {
    id: "toggle-layout",
    scope: "global",
    key: "l",
    code: "KeyL",
    modifiers: { shift: true },
    handler: () => toggleLayout(),
  },
  {
    id: "toggle-layout-ctrl",
    scope: "global",
    key: "\\",
    code: "Backslash",
    modifiers: { ctrlOrMeta: true },
    handler: () => toggleLayout(),
  },
  {
    id: "focus-tree-pane",
    scope: "global",
    key: "[",
    code: "BracketLeft",
    handler: () => focusTreePane(),
  },
  {
    id: "report-tab-results",
    scope: "global",
    key: "1",
    handler: () => goToReportRootTab(REPORT_ROOT_TAB.Results),
  },
  {
    id: "report-tab-categories",
    scope: "global",
    key: "2",
    handler: () => goToReportRootTab(REPORT_ROOT_TAB.Categories),
  },
  {
    id: "report-tab-quality-gate",
    scope: "global",
    key: "3",
    handler: () => goToReportRootTab(REPORT_ROOT_TAB.QualityGate),
  },
  {
    id: "report-tab-global-attachments",
    scope: "global",
    key: "4",
    handler: () => goToReportRootTab(REPORT_ROOT_TAB.GlobalAttachments),
  },
  {
    id: "report-tab-global-errors",
    scope: "global",
    key: "5",
    handler: () => goToReportRootTab(REPORT_ROOT_TAB.GlobalErrors),
  },
  {
    id: "report-tab-next",
    scope: "global",
    key: "Tab",
    handler: () => cycleReportRootTabHotkey("next"),
  },
  {
    id: "report-tab-prev",
    scope: "global",
    key: "Tab",
    modifiers: { shift: true },
    handler: () => cycleReportRootTabHotkey("prev"),
  },
  {
    id: "focus-tree-pane-fallback",
    scope: "global",
    key: "[",
    handler: () => focusTreePane(),
  },
  {
    id: "focus-test-result-pane",
    scope: "global",
    key: "]",
    code: "BracketRight",
    handler: () => focusTestResultPaneIfOpen(),
  },
  {
    id: "focus-test-result-pane-fallback",
    scope: "global",
    key: "]",
    handler: () => focusTestResultPaneIfOpen(),
  },
  {
    id: "tree-up",
    scope: "tree",
    key: "ArrowUp",
    handler: () => applyTreeNavigation("up"),
  },
  {
    id: "tree-down",
    scope: "tree",
    key: "ArrowDown",
    handler: () => applyTreeNavigation("down"),
  },
  {
    id: "tree-left",
    scope: "tree",
    key: "ArrowLeft",
    handler: () => applyTreeNavigation("left"),
  },
  {
    id: "tree-right",
    scope: "tree",
    key: "ArrowRight",
    handler: () => applyTreeNavigation("right"),
  },
  {
    id: "tree-up-vim",
    scope: "tree",
    key: "k",
    code: "KeyK",
    handler: () => applyTreeNavigation("up"),
  },
  {
    id: "tree-down-vim",
    scope: "tree",
    key: "j",
    code: "KeyJ",
    handler: () => applyTreeNavigation("down"),
  },
  {
    id: "tree-left-vim",
    scope: "tree",
    key: "h",
    code: "KeyH",
    handler: () => applyTreeNavigation("left"),
  },
  {
    id: "tree-right-vim",
    scope: "tree",
    key: "l",
    code: "KeyL",
    handler: () => applyTreeNavigation("right"),
  },
  {
    id: "tree-parent",
    scope: "tree",
    key: "p",
    code: "KeyP",
    handler: () => applyTreeNavigation("parent"),
  },
  {
    id: "tree-parent-alt",
    scope: "tree",
    key: "u",
    code: "KeyU",
    handler: () => applyTreeNavigation("parent"),
  },
  {
    id: "tree-open",
    scope: "tree",
    key: "o",
    code: "KeyO",
    handler: () => openTreeNodeFromFocus(),
  },
  {
    id: "tree-collapse",
    scope: "tree",
    key: "-",
    code: "Minus",
    handler: () => applyTreeNavigation("left"),
  },
  {
    id: "tree-expand",
    scope: "tree",
    key: "+",
    code: "Equal",
    modifiers: { shift: true },
    handler: () => applyTreeNavigation("firstChild"),
  },
  {
    id: "tree-expand-equal",
    scope: "tree",
    key: "=",
    code: "Equal",
    handler: () => applyTreeNavigation("firstChild"),
  },
  {
    id: "toggle-report-variables",
    scope: "tree",
    key: "V",
    code: "KeyV",
    handler: () => toggleReportEnvSection("variables"),
  },
  {
    id: "toggle-report-metadata",
    scope: "tree",
    key: "M",
    code: "KeyM",
    handler: () => toggleReportEnvSection("metadata"),
  },
  {
    id: "tree-collapse-all",
    scope: "tree",
    key: "C",
    code: "KeyC",
    handler: () => collapseAllChildrenFromFocus(),
  },
  {
    id: "tree-expand-all",
    scope: "tree",
    key: "A",
    code: "KeyA",
    handler: () => expandAllChildrenFromFocus(),
  },
  {
    id: "tree-subtree-collapse",
    scope: "tree",
    key: "C",
    code: "KeyC",
    modifiers: { shift: true },
    handler: () => collapseFocusedSubtree(),
  },
  {
    id: "tree-subtree-expand",
    scope: "tree",
    key: "A",
    code: "KeyA",
    modifiers: { shift: true },
    handler: () => expandFocusedSubtree(),
  },
  {
    id: "tree-subtree-first-level",
    scope: "tree",
    key: "f",
    code: "KeyF",
    handler: () => expandFocusedSubtreeFirstLevel(),
  },
  {
    id: "tree-subtree-cycle",
    scope: "tree",
    key: ">",
    code: "Period",
    modifiers: { shift: true },
    handler: () => cycleFocusedSubtreeToggle(),
  },
  {
    id: "tree-home",
    scope: "tree",
    key: "Home",
    handler: () => applyTreeNavigation("home"),
  },
  {
    id: "tree-scroll-top-z",
    scope: "tree",
    key: "z",
    code: "KeyZ",
    handler: () => applyTreeNavigation("z"),
  },
  {
    id: "tree-scroll-top-t",
    scope: "tree",
    key: "t",
    code: "KeyT",
    handler: () => applyTreeNavigation("t"),
  },
  {
    id: "tree-end",
    scope: "tree",
    key: "End",
    handler: () => applyTreeNavigation("end"),
  },
  {
    id: "tree-go-first",
    scope: "tree",
    key: "g",
    handler: () => applyTreeNavigation("g"),
  },
  {
    id: "tree-last-leaf",
    scope: "tree",
    key: "G",
    modifiers: { shift: true },
    handler: () => applyTreeNavigation("lastLeaf"),
  },
  {
    id: "tree-toggle",
    scope: "tree",
    key: " ",
    handler: () => toggleTreeNodeFromFocus(),
  },
  {
    id: "tree-open-enter",
    scope: "tree",
    key: "Enter",
    handler: () => openTestResultFromTree(),
  },
  {
    id: "test-result-prev",
    scope: "testResult",
    key: "N",
    code: "KeyN",
    modifiers: { shift: true },
    handler: () => goToPrevTestResult(),
  },
  {
    id: "test-result-next",
    scope: "testResult",
    key: "n",
    code: "KeyN",
    handler: () => goToNextTestResult(),
  },
  {
    id: "test-result-tab-overview",
    scope: "testResult",
    key: "1",
    handler: () => goToTestResultTab(TEST_RESULT_TAB.Overview),
  },
  {
    id: "test-result-tab-history",
    scope: "testResult",
    key: "2",
    handler: () => goToTestResultTab(TEST_RESULT_TAB.History),
  },
  {
    id: "test-result-tab-retries",
    scope: "testResult",
    key: "3",
    handler: () => goToTestResultTab(TEST_RESULT_TAB.Retries),
  },
  {
    id: "test-result-tab-attachments",
    scope: "testResult",
    key: "4",
    handler: () => goToTestResultTab(TEST_RESULT_TAB.Attachments),
  },
  {
    id: "test-result-tab-environments",
    scope: "testResult",
    key: "5",
    handler: () => goToTestResultTab(TEST_RESULT_TAB.Environments),
  },
  {
    id: "test-result-tab-next",
    scope: "testResult",
    key: "Tab",
    handler: () => cycleTestResultTabHotkey("next"),
  },
  {
    id: "test-result-tab-prev",
    scope: "testResult",
    key: "Tab",
    modifiers: { shift: true },
    handler: () => cycleTestResultTabHotkey("prev"),
  },
  {
    id: "test-result-overview-down",
    scope: "testResult",
    key: "ArrowDown",
    handler: () => navigateDownInTestResultPane(),
  },
  {
    id: "test-result-overview-down-vim",
    scope: "testResult",
    key: "j",
    code: "KeyJ",
    handler: () => navigateDownInTestResultPane(),
  },
  {
    id: "test-result-overview-up",
    scope: "testResult",
    key: "ArrowUp",
    handler: () => navigateUpInTestResultPane(),
  },
  {
    id: "test-result-overview-up-vim",
    scope: "testResult",
    key: "k",
    code: "KeyK",
    handler: () => navigateUpInTestResultPane(),
  },
  {
    id: "toggle-labels",
    scope: "testResult",
    key: "l",
    code: "KeyL",
    handler: () => toggleMetadataSection("labels"),
  },
  {
    id: "toggle-parameters",
    scope: "testResult",
    key: "p",
    code: "KeyP",
    handler: () => toggleMetadataSection("parameters"),
  },
  {
    id: "toggle-links",
    scope: "testResult",
    key: "i",
    code: "KeyI",
    handler: () => toggleMetadataSection("links"),
  },
];

export const HotkeysProvider = () => {
  useEffect(() => {
    const controller = createHotkeyController({
      getActiveScope: getHotkeyScope,
      getEnabled: isHotkeysEnabled,
      isScopeActive: isHotkeyScopeActive,
      bindings: createBindings(),
      shouldSuppressDefault: shouldSuppressHotkeyScroll,
    });

    controller.attach();

    return () => controller.detach();
  }, []);

  return null;
};
