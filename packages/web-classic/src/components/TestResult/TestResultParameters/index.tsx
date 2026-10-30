import { Button } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { MetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const PARAMETERS_VISIBLE_LIMIT = 8;

export type TestResultParametersProps = {
  parameters: ReportTestResult["parameters"];
};

export const TestResultParameters: FunctionalComponent<TestResultParametersProps> = ({ parameters }) => {
  const [isOpened, setIsOpened] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { t } = useI18n("ui");
  const list = parameters ?? [];
  const hasMore = list.length > PARAMETERS_VISIBLE_LIMIT;
  const visibleList = hasMore && !showAll ? list.slice(0, PARAMETERS_VISIBLE_LIMIT) : list;

  return (
    <div className={styles["test-result-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={setIsOpened}
        counter={parameters?.length}
        title={t("parameters")}
      />
      <div className={styles["test-result-metadata-wrapper"]}>
        {isOpened && (
          <>
            {/* FIXME: use proper type in the MetadataList component */}
            {/* @ts-ignore */}
            <MetadataList envInfo={visibleList} />
            {hasMore && (
              <Button
                style="ghost"
                size="s"
                text={showAll ? t("showLess") : t("showMore")}
                onClick={() => setShowAll(!showAll)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
