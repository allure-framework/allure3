import LineDevCodeSquare from "@/assets/svg/line-dev-code-square.svg";
import * as baseStyles from "@/components/app/BaseLayout/styles.scss";
import { TestResultInfo } from "@/components/app/TestResult/TestResultInfo";
import { SvgIcon } from "@/components/commons/SvgIcon";
import { Text } from "@/components/commons/Typography";
import * as styles from "./styles.scss";

const TestResultThumb = () => {
  return (
    <div className={styles["test-result-thumb"]}>
      <div className={styles["test-result-thumb-wrapper"]}>
        <SvgIcon
          size={"m"}
          width={"32px"}
          height={"32px"}
          id={LineDevCodeSquare.id}
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
