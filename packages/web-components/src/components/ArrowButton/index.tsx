import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import styles from "./styles.scss";

export interface ArrowButtonProps {
  isOpened?: boolean;
  iconSize?: "m" | "xs" | "s";
  buttonSize?: "m" | "xs" | "s";
  className?: string;
  icon?: string;
  onClick?: VoidFunction;
}

export const ArrowButton: FunctionalComponent<ArrowButtonProps> = ({
  isOpened,
  buttonSize = "m",
  iconSize = "xs",
  className,
  icon = allureIcons.lineArrowsChevronDown,
  onClick,
  ...rest
}) => {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(styles["arrow-button"], styles[`arrow-button-${buttonSize}`])}
      onClick={onClick}
    >
      <SvgIcon
        id={icon}
        size={iconSize}
        className={clsx(
          {
            [styles["arrow-button-icon--opened"]]: isOpened,
          },
          styles["arrow-button-icon"],
          styles[`icon-size-${iconSize}`],
          className,
        )}
      />
    </button>
  );
};
