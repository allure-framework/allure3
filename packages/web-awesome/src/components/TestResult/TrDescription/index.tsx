import { Text } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import * as styles from "./styles.scss";

export type TrDescriptionProps = {
  description: AwesomeTestResult["description"];
};

export const TrDescription: FunctionalComponent<TrDescriptionProps> = ({ description }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <div className={styles["test-result-description"]}>
      <div className={styles["test-result-description-wrapper"]}>
        <MetadataButton title={"Description"} setIsOpen={setIsOpen} isOpened={isOpen} />
        {isOpen && (
          <Text tag={"p"} className={styles["test-result-description-text"]}>
            {description}
          </Text>
        )}
      </div>
    </div>
  );
};
