import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { PwTraceButton } from "@/components/TestResult/TrQuickActions/PwTraceButton";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

export type TrMetadataProps = {
  testResult?: AwesomeTestResult;
};

export const TrQuickActions: FunctionalComponent<TrMetadataProps> = ({ testResult }) => {
  const { t } = useI18n("ui");
  const { labels } = testResult ?? {};
  const [isOpened, setIsOpened] = useState(true);

  return (
    <div className={styles["tr-metadata"]}>
      <MetadataButton isOpened={isOpened} setIsOpen={setIsOpened} counter={labels?.length} title={t("quickActions")} />
      <div className={styles["tr-metadata-wrapper"]}>{isOpened && <PwTraceButton />}</div>
    </div>
  );
};
