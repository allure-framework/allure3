import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TestResultMetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

export type TestResultMetadataProps = {
  testResult?: AwesomeTestResult;
};

export const TestResultMetadata: FunctionalComponent<TestResultMetadataProps> = ({ testResult }) => {
  const { t } = useI18n("ui");
  const { labels, groupedLabels } = testResult ?? {};
  const [isOpened, setIsOpened] = useState(true);

  return (
    <div className={styles["test-result-metadata"]}>
      <MetadataButton isOpened={isOpened} setIsOpen={setIsOpened} counter={labels?.length} title={t("labels")} />

      <div className={styles["test-result-metadata-wrapper"]}>
        {isOpened && <TestResultMetadataList groupedLabels={groupedLabels} />}
      </div>
    </div>
  );
};
