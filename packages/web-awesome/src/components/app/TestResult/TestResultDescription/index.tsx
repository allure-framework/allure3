import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { MetadataButton } from "@/components/app/MetadataButton";
import { Text } from "@/components/commons/Typography";
import { AllureAwesomeTestResult } from "../../../../../types";
import * as styles from "./styles.scss";

export type TestResultDescriptionProps = {
  description: AllureAwesomeTestResult["description"];
};

export const TestResultDescription: FunctionalComponent<TestResultDescriptionProps> = ({ description }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <div className={styles["test-result-description"]}>
      <div className={styles["test-result-description-wrapper"]}>
        <MetadataButton title={"Description"} setIsOpen={setIsOpen} isOpened={isOpen} />
        {isOpen && (
          <Text tag={"p"} className={styles["test-result-description-text"]}>
            {description || "Description mock"}
          </Text>
        )}
      </div>
    </div>
  );
};
