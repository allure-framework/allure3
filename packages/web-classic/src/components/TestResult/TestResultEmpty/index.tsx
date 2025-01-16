import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import * as baseStyles from "@/components/BaseLayout/styles.scss";
import { TestResultInfo } from "@/components/TestResult/TestResultInfo";
import * as styles from "./styles.scss";

const TestResultThumb = () => {
  return (
    <div className={styles["test-result-thumb"]}>
      <div className={styles["test-result-thumb-wrapper"]}>
        <SvgIcon
          size={"m"}
          width={"32px"}
          height={"32px"}
          id={allureIcons.lineDevCodeSquare}
          className={styles["test-result-thumb-icon"]}
        />
        <Text className={styles["test-result-thumb-text"]}>No test case results</Text>
      </div>
    </div>
  );
};

const TestResultEmpty = () => {
  return (
    <div className={baseStyles.content}>
      <TestResultInfo />
      <TestResultThumb />
    </div>
  );
};

export default TestResultEmpty;
