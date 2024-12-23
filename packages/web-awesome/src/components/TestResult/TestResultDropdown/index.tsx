import { Counter } from "@allurereport/web-components";
import { SvgIcon } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import { ArrowButton } from "@/components/ArrowButton";
import * as styles from "./styles.scss";

export const TestResultDropdown = ({ isOpened, setIsOpen, title, icon, counter }) => {
  return (
    <div className={styles["test-result-dropdown"]} onClick={() => setIsOpen(!isOpened)}>
      <ArrowButton isOpened={isOpened} icon={arrowsChevronDown.id} />
      <div className={styles["test-result-dropdown-wrap"]}>
        <SvgIcon id={icon} />
        <Text bold>{title}</Text>
        <Counter count={counter} size="s" />
      </div>
    </div>
  );
};
