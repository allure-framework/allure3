import { ArrowButton, Counter, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import { type FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export const TrDropdown: FunctionalComponent<{
  isOpened: boolean;
  setIsOpen: (isOpened: boolean) => void;
  title: string;
  icon: string;
  counter: number;
  className?: ClassValue;
}> = ({ isOpened, setIsOpen, title, icon, counter, className }) => {
  return (
    <div className={clsx(styles["test-result-dropdown"], className)} onClick={() => setIsOpen(!isOpened)}>
      <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
      <div className={styles["test-result-dropdown-wrap"]}>
        <SvgIcon id={icon} />
        <Text bold>{title}</Text>
        <Counter count={counter} size="s" />
      </div>
    </div>
  );
};
