import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { MetadataButton } from "@/components/MetadataButton";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export const TrErrorStack: FunctionalComponent<{ errors: TestResult["errors"]; status: TestStatus }> = ({
  errors,
  status,
}) => {
  const { t } = useI18n("ui");
  const [isOpened, setIsOpened] = useState(true);

  return (
    <div className={styles["tr-error-stack"]}>
      {errors.length > 1 && (
        <MetadataButton isOpened={isOpened} setIsOpen={setIsOpened} counter={errors?.length} title={t("errorStack")} />
      )}
      {isOpened && errors.map((error, key) => <TrError key={key} {...error} status={status} />)}
    </div>
  );
};
