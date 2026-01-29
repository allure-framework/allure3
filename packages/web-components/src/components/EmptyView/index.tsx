import clsx from "clsx";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { SvgIcon, type SvgIconProps } from "../SvgIcon";
import { Text } from "../Typography";
import styles from "./styles.scss";

type Size = "s" | "m" | "xs";

type Props = {
  title?: ComponentChildren;
  description?: ComponentChildren;
  icon?: string;
  iconColor?:
    | "skat"
    | "aldebaran"
    | "castor"
    | "atlas"
    | "betelgeuse"
    | "sirius"
    | "antares"
    | "gliese"
    | "capella"
    | "rigel"
    | "mirach"
    | "rau";
  fullHeight?: boolean;
  size?: Size;
  className?: string;
  iconClassName?: string;
  border?: boolean;
};

const iconSizes: Record<Size, SvgIconProps["size"]> = {
  s: "s",
  m: "m",
  xs: "xs",
} as const;

export const EmptyView: FunctionalComponent<Props> = (props) => {
  const {
    children,
    description,
    title,
    icon,
    iconColor,
    fullHeight = true,
    size = "m",
    className,
    iconClassName,
    border = false,
  } = props;

  return (
    <div
      data-size={size}
      data-full-height={fullHeight || undefined}
      data-border={border || undefined}
      className={clsx(styles.container, className)}
    >
      {!!icon && (
        <SvgIcon
          id={icon}
          className={clsx(styles.emptyIcon, iconClassName)}
          data-size={iconSizes[size]}
          data-color={iconColor}
        />
      )}
      <div className={styles.textContainer}>
        {title && (
          <Text tag="b" size={size === "s" ? "m" : "l"} bold className={styles.title}>
            {title}
          </Text>
        )}
        {!!description && (
          <Text tag="p" size="m" className={styles.description}>
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
};
