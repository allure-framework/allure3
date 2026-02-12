import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import * as styles from "./styles.scss";

export type TrMetadataProps = {
  testResult?: AwesomeTestResult;
  pwTraces?: AttachmentTestStepResult[];
};

export const TrPwTraces: FunctionalComponent<TrMetadataProps> = ({ pwTraces }) => {
  const [isOpened, setIsOpened] = useState(true);

  return (
    <div className={styles["tr-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={setIsOpened}
        counter={pwTraces?.length}
        title={"Playwright Trace"}
      />
      {isOpened && (
        <div className={styles["tr-metadata-wrapper"]}>
          {pwTraces?.map((pw, index) => <TrAttachment stepIndex={index + 1} item={pw} key={pw.link.id} />)}
        </div>
      )}
    </div>
  );
};
