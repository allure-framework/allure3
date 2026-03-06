import { Button } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";

import { MetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

const PARAMETERS_VISIBLE_LIMIT = 8;

export type TrParametersProps = {
  id?: string;
  parameters: AwesomeTestResult["parameters"];
};

export const TrParameters: FunctionalComponent<TrParametersProps> = ({ id, parameters }) => {
  const { t } = useI18n("ui");
  const parametersId = id !== null ? `${id}-parameters` : null;
  const parametersShowAllId = id !== null ? `${id}-parameters-showAll` : null;
  const isOpened = !collapsedTrees.value.has(parametersId);
  const list = parameters ?? [];
  const totalCount = list.length;
  const showAll = collapsedTrees.value.has(parametersShowAllId);
  const visibleList = showAll ? list : list.slice(0, PARAMETERS_VISIBLE_LIMIT);

  return (
    <div className={styles["test-result-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={() => {
          if (parametersId !== null) {
            toggleTree(parametersId);
          }
        }}
        counter={parameters?.length}
        title={t("parameters")}
      />
      <div className={styles["test-result-metadata-wrapper"]}>
        {isOpened && (
          <>
            {/* FIXME: use proper type in the MetadataList component */}
            {/* @ts-ignore */}
            <MetadataList envInfo={visibleList} />
            {totalCount > PARAMETERS_VISIBLE_LIMIT && (
              <Button
                style="ghost"
                size="s"
                text={showAll ? t("showLess") : t("showMore")}
                onClick={() => {
                  if (parametersShowAllId !== null) {
                    toggleTree(parametersShowAllId);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
