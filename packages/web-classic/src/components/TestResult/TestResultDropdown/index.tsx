import { Counter, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { ArrowButton } from "@/components/ArrowButton";
import * as styles from "./styles.scss";

export const TestResultDropdown: FunctionalComponent<{
  isOpened: boolean;
  setIsOpen: (isOpened: boolean) => void;
  title: string;
  icon: string;
  counter: number;
}> = ({ isOpened, setIsOpen, title, icon, counter }) => {
  return (
    <div className={styles["test-result-dropdown"]} onClick={() => setIsOpen(!isOpened)}>
      <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
      <div className={styles["test-result-dropdown-wrap"]}>
        <SvgIcon id={icon} />
        <Text bold>{title}</Text>
        <Counter count={counter} size="s" />
      </div>
    </div>
  );
};
