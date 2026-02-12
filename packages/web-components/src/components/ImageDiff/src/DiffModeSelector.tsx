import { For } from "@preact/signals/utils";
import { Tab, Tabs, TabsList } from "@/components/Tabs";
import { useImageDiffContext } from "./hooks.js";
import { useI18n } from "./i18n.js";
import type { DiffMode } from "./model.js";
import styles from "./styles.scss";

const defaultI18n: Record<DiffMode, string> = {
  "diff": "Diff",
  "actual": "Actual",
  "expected": "Expected",
  "side-by-side": "Side by side",
  "overlay": "Overlay",
};

export const DiffModeSelector = () => {
  const { diffModes, diffMode } = useImageDiffContext();
  const i18n = useI18n();

  return (
    <div className={styles.selector}>
      <Tabs>
        <TabsList>
          <For each={diffModes}>
            {(mode) => (
              <Tab
                key={mode}
                tabId={mode}
                isCurrentTab={diffMode.value === mode}
                onClick={() => (diffMode.value = mode)}
              >
                {i18n?.(`mode.${mode as DiffMode}`) ?? defaultI18n[mode as DiffMode]}
              </Tab>
            )}
          </For>
        </TabsList>
      </Tabs>
    </div>
  );
};
