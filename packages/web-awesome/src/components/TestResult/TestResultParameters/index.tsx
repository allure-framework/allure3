import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

export type TestResultParametersProps = {
  parameters: AwesomeTestResult["parameters"];
};

export const TestResultParameters: FunctionalComponent<TestResultParametersProps> = ({ parameters }) => {
  const [isOpened, setIsOpened] = useState(true);
  const { t } = useI18n("ui");

  return (
    <div className={styles["test-result-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={setIsOpened}
        counter={parameters?.length}
        title={t("parameters")}
      />
      {/* FIXME: use proper type in the MetadataList component */}
      {/* @ts-ignore */}
      <div className={styles["test-result-metadata-wrapper"]}>{isOpened && <MetadataList envInfo={parameters} />}</div>
    </div>
  );
};
