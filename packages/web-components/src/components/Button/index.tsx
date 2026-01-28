import { clsx } from "clsx";
import type { ComponentChild } from "preact";
import { Spinner } from "@/components/Spinner";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

type BaseBtnProps = {
  /**
   * Text to be displayed on the button
   * Should not contain any JSX, only plain text
   */
  text?: string;
  /**
   * Indicates if the button is in a pending state
   */
  isPending?: boolean;
  /**
   * Size of the button
   *
   * @default m
   *
   * - `xs` - Extra small button
   * - `s` - Small button
   * - `m` - Medium button
   * - `l` - Large button
   */
  size?: "xs" | "s" | "m" | "l";
  /**
   * Style of the button
   *
   * @default primary
   *
   * - `primary` - Primary button
   * - `outline` - Outline button
   * - `ghost` - Ghost button
   * - `flat` - Flat button
   * - `raised` - Raised button
   */
  style?: "primary" | "outline" | "ghost" | "flat" | "raised";
  /**
   * - `danger` - Indicates if the button is a danger button
   * - `positive` - Indicates if the button is a positive button
   *
   * @default "default"
   */
  action?: "default" | "danger" | "positive";
  /**
   * Icon to be displayed on the button
   */
  icon?: string;
  /**
   * Custom icon size on the button
   */
  iconSize?: "xs" | "s" | "m";
  /**
   * Color of the icon
   * applied only when style is not primary
   * and action is default
   */
  iconColor?: "primary" | "secondary";
  /**
   * Indicates if the button should take the full width of its container
   */
  fullWidth?: boolean;
  /**
   * Indicates if the button is an icon button
   */
  isIconButton?: boolean;
  /**
   * Indicates if the button is a dropdown button
   */
  isDropdownButton?: boolean;
  /**
   * Callback to be called when the button is pressed
   */
  onClick?: (e: MouseEvent) => void;
  /**
   * Type of the button
   * same as HTML Button type
   */
  type?: HTMLButtonElement["type"];
  /**
   * Indicates if the button is disabled or not
   * this tells screen readers to ignore the button
   * But the button is still focusable in order to show the tooltip
   */
  isDisabled?: boolean;
  /**
   * For visual "active" state
   *
   * Used for dropdown buttons mainly
   */
  isActive?: boolean;
  /**
   * Indicates if the button is focusable
   *
   * @default true
   */
  focusable?: boolean;
  /**
   * URL to navigate to when the button is clicked
   * If provided, the button will be rendered as an anchor element
   */
  href?: string;
  rounded?: boolean;
  target?: HTMLAnchorElement["target"];
  className?: string;
  dataTestId?: string;
  leadingSlot?: ComponentChild;
  trailingSlot?: ComponentChild;
  isLink?: boolean;
};

const BaseBtn = (props: BaseBtnProps) => {
  const {
    text,
    type = "button",
    icon,
    iconSize = "m",
    onClick,
    isPending = false,
    size = "m",
    style = "primary",
    action = "default",
    fullWidth = false,
    isDisabled = false,
    isIconButton = false,
    isDropdownButton = false,
    isActive = false,
    focusable = true,
    href,
    target = "_self",
    className,
    leadingSlot,
    trailingSlot,
    rounded,
    isLink = false,
    iconColor = "primary",
    ...rest
  } = props;
  const isButtonDisabled = isDisabled || isPending;

  // Common props for both button and anchor
  const commonProps = {
    ...rest,
    "tabIndex": focusable ? 0 : -1,
    "className": clsx(
      styles.button,
      isIconButton && styles.buttonIcon,
      styles[`size_${size}`],
      styles[`icon_size_${iconSize}`],
      styles[`style_${style}`],
      action === "danger" && styles.danger,
      action === "positive" && styles.positive,
      isPending && styles.pending,
      fullWidth && styles.fullWidth,
      !isButtonDisabled && isActive && styles.active,
      className,
    ),
    onClick,
    "data-rounded": rounded || undefined,
    "data-link": isLink || undefined,
    "data-icon-color": (action === "default" && iconColor) || undefined,
  };

  // Common content for both button and anchor
  const content = (
    <Text type="ui" size={size === "s" ? "s" : "m"} bold className={styles.content}>
      {icon && <SvgIcon size="s" className={isIconButton ? styles.contentIcon : styles.leadingIcon} id={icon} />}
      {leadingSlot && <div className={styles.leadingSlot}>{leadingSlot}</div>}
      {!isIconButton && <span className={styles.text}>{text}</span>}
      {trailingSlot && <div className={styles.trailingSlot}>{trailingSlot}</div>}
      {isDropdownButton && <SvgIcon id={allureIcons.lineArrowsChevronDown} size="s" className={styles.dropdownIcon} />}
      <span className={styles.spinner} aria-hidden={!isPending}>
        <Spinner />
      </span>
    </Text>
  );

  if (href) {
    return (
      <a
        {...commonProps}
        href={href}
        target={target}
        aria-disabled={isButtonDisabled ? "true" : undefined}
        style={isButtonDisabled ? { pointerEvents: "none" } : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button {...commonProps} disabled={isButtonDisabled} type={type}>
      {content}
    </button>
  );
};

export type ButtonProps = Omit<BaseBtnProps, "text" | "isIconButton" | "isDropdownButton" | "rounded" | "isLink"> &
  Pick<Required<BaseBtnProps>, "text">;

export const Button = (props: ButtonProps) => <BaseBtn {...props} />;

export type IconButtonProps = Omit<
  BaseBtnProps,
  | "text"
  | "icon"
  | "autoFocus"
  | "fullWidth"
  | "isIconButton"
  | "isDropdownButton"
  | "trailingSlot"
  | "leadingSlot"
  | "isLink"
> &
  Pick<Required<BaseBtnProps>, "icon"> & {
    rounded?: boolean;
  };

export const IconButton = (props: IconButtonProps) => <BaseBtn {...props} isIconButton />;

type DropdownButtonProps = Omit<
  BaseBtnProps,
  "type" | "autoFocus" | "isDropdownButton" | "isIconButton" | "text" | "isActive" | "isLink"
> &
  Pick<Required<BaseBtnProps>, "text"> & {
    isExpanded?: boolean;
  };

export const DropdownButton = (props: DropdownButtonProps) => (
  <BaseBtn {...props} isDropdownButton isActive={props.isExpanded} />
);

export const ButtonLink = (props: Omit<BaseBtnProps, "href" | "isLink"> & Pick<Required<BaseBtnProps>, "href">) => (
  <BaseBtn {...props} href={props.href} target={props.target} isLink />
);
