import { Button, Code, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";

import { useI18n } from "@/stores";
import { activePane, hotkeysHelpOpen, toggleHotkeysHelp } from "@/stores/keyboard";
import { isSplitMode } from "@/stores/layout";

import { formatShortcut, shortcutGroups, type ShortcutGroupId } from "./shortcutsConfig";

import * as styles from "./styles.scss";

const visibleGroups = (pane: "tree" | "testResult", split: boolean): ShortcutGroupId[] => {
  const groups: ShortcutGroupId[] = ["global", "tree"];

  if (split || pane === "testResult") {
    groups.push("testResult");
  }

  return groups;
};

export const KeyboardShortcuts = () => {
  const { t } = useI18n("shortcuts");
  const pane = activePane.value;
  const split = isSplitMode.value;
  const groups = shortcutGroups.filter((group) => visibleGroups(pane, split).includes(group.id));

  return (
    <div className={styles.shortcuts} data-testid="keyboard-shortcuts">
      {hotkeysHelpOpen.value && (
        <div className={styles.panel} data-testid="keyboard-shortcuts-panel">
          <div className={styles.header}>
            <Text size="m" bold>
              {t("title")}
            </Text>
            <Button
              style="ghost"
              size="xs"
              icon={allureIcons.lineGeneralXClose}
              onClick={() => toggleHotkeysHelp()}
              data-testid="keyboard-shortcuts-close"
            />
          </div>
          {groups.map((group) => (
            <div key={group.id} className={styles.group}>
              <Code size="s" className={styles.groupTitle}>
                {t(group.titleKey)}
              </Code>
              {group.items.map((item) => (
                <div key={`${group.id}-${item.labelKey}`} className={styles.item}>
                  <Code size="s" className={clsx(styles.keys, "hotkey")}>
                    {formatShortcut(item.binding)}
                  </Code>
                  <Text size="s" className={styles.label}>
                    {t(item.labelKey)}
                  </Text>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Button
        className={styles.trigger}
        style="outline"
        size="s"
        text="?"
        onClick={() => toggleHotkeysHelp()}
        data-testid="keyboard-shortcuts-trigger"
      />
    </div>
  );
};
