import { Button } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";

import { TrMetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

const VISIBLE_LABELS_LIMIT = 8;

export type TrMetadataProps = {
  id?: string;
  testResult?: AwesomeTestResult;
};

export const TrMetadata: FunctionalComponent<TrMetadataProps> = ({ id, testResult }) => {
  const { t } = useI18n("ui");
  const { labels, groupedLabels } = testResult ?? {};
  const labelsId = id !== null ? `${id}-labels` : null;
  const labelsShowAllId = id !== null ? `${id}-labels-showAll` : null;
  const isOpened = !collapsedTrees.value.has(labelsId);
  const entries = groupedLabels ? Object.entries(groupedLabels) : [];
  const showAll = collapsedTrees.value.has(labelsShowAllId);
  const visibleEntries = showAll ? entries : entries.slice(0, VISIBLE_LABELS_LIMIT);
  const groupedLabelsVisible = Object.fromEntries(visibleEntries);

  const handleToggleShowAll = () => {
    if (labelsShowAllId !== null) {
      toggleTree(labelsShowAllId);
    }
  };

  return (
    <div className={styles["test-result-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={() => {
          if (labelsId !== null) {
            toggleTree(labelsId);
          }
        }}
        counter={labels?.length}
        title={t("labels")}
      />

      <div className={styles["test-result-metadata-wrapper"]}>
        {isOpened && (
          <>
            <TrMetadataList groupedLabels={groupedLabelsVisible} />
            {entries.length > VISIBLE_LABELS_LIMIT && (
              <Button
                style="ghost"
                size="s"
                text={showAll ? t("showLess") : t("showMore")}
                onClick={handleToggleShowAll}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
