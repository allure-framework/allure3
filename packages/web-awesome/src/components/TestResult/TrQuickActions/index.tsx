import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

export type TrMetadataProps = {
  testResult?: AwesomeTestResult;
};

export const TrQuickActions: FunctionalComponent<TrMetadataProps> = ({ testResult }) => {
  const { t } = useI18n("ui");
  const [isOpened, setIsOpened] = useState(true);
  const pwTraces = testResult?.attachments?.filter(
    (attachment) => attachment.link.name === "trace" || attachment.link.isPwTrace,
  );

  return (
    <div className={styles["tr-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={setIsOpened}
        counter={pwTraces?.length}
        title={t("quickActions")}
      />
      {isOpened && (
        <div className={styles["tr-metadata-wrapper"]}>
          {pwTraces.map((pw, index) => (
            <TrAttachment stepIndex={index + 1} item={pw} key={pw.link.id} />
          ))}
        </div>
      )}
    </div>
  );
};
