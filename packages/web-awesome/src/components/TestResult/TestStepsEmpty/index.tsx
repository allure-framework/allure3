import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

const TrStepsEmpty = () => {
  const { t } = useI18n("empty");
  return (
    <div className={styles["test-steps-empty"]}>
      <div className={styles["test-steps-empty-wrapper"]}>
        <SvgIcon
          size={"m"}
          width={"32px"}
          height={"32px"}
          id={allureIcons.lineDevCodeSquare}
          className={styles["test-steps-empty-icon"]}
        />
        <Text className={styles["test-steps-empty-text"]}>{t("no-test-steps-results")}</Text>
      </div>
    </div>
  );
};

export default TrStepsEmpty;
