import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export interface ArrowButtonProps {
  isOpened?: boolean;
  iconSize?: "m" | "xs" | "s";
  buttonSize?: "m" | "xs" | "s";
  className?: string;
  icon?: string;
}

export const ArrowButton: FunctionalComponent<ArrowButtonProps> = ({
  isOpened,
  buttonSize = "m",
  iconSize = "xs",
  className,
  icon = allureIcons.lineArrowsChevronDown,
  ...rest
}) => {
  return (
    <button className={clsx(styles["arrow-button"], styles[`arrow-button-${buttonSize}`])} {...rest}>
      <SvgIcon
        id={icon}
        size={iconSize}
        className={clsx(
          styles["arrow-button-icon"],
          isOpened && styles["arrow-button-icon--opened"],
          styles[`icon-size-${iconSize}`],
          className,
        )}
      />
    </button>
  );
};
