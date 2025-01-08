import { clsx } from "clsx";
import lineChevronDownIcon from "@/assets/svg/line-arrows-chevron-down.svg";
import { Spinner } from "@/components/Spinner";
import { SvgIcon } from "@/components/SvgIcon";
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
   * - `s` - Small button
   * - `m` - Medium button
   * - `l` - Large button
   */
  size?: "s" | "m" | "l";
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
  className?: string;
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
    className,
    ...rest
  } = props;

  const isButtonDisabled = isDisabled || isPending;

  return (
    <button
      {...rest}
      tabIndex={focusable ? 0 : -1}
      className={clsx(
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
      )}
      disabled={isButtonDisabled}
      onClick={onClick}
      type={type}
    >
      <Text type="ui" size={size === "s" ? "s" : "m"} bold className={styles.content}>
        {icon && <SvgIcon size="s" className={isIconButton ? styles.contentIcon : styles.leadingIcon} id={icon} />}
        {!isIconButton && <span className={styles.text}>{text}</span>}
        {isDropdownButton && <SvgIcon id={lineChevronDownIcon.id} size="s" className={styles.dropdownIcon} />}
        <span className={styles.spinner} aria-hidden={!isPending}>
          <Spinner />
        </span>
      </Text>
    </button>
  );
};

export type ButtonProps = Omit<BaseBtnProps, "text" | "isIconButton" | "isDropdownButton"> &
  Pick<Required<BaseBtnProps>, "text">;

export const Button = (props: ButtonProps) => <BaseBtn {...props} />;

export type IconButtonProps = Omit<
  BaseBtnProps,
  "text" | "icon" | "autoFocus" | "fullWidth" | "isIconButton" | "isDropdownButton"
> &
  Pick<Required<BaseBtnProps>, "icon">;

export const IconButton = (props: IconButtonProps) => <BaseBtn {...props} isIconButton />;

type DropdownButtonProps = Omit<
  BaseBtnProps,
  "type" | "autoFocus" | "isDropdownButton" | "isIconButton" | "text" | "icon" | "isActive"
> &
  Pick<Required<BaseBtnProps>, "text"> & {
    isExpanded?: boolean;
  };

export const DropdownButton = (props: DropdownButtonProps) => (
  <BaseBtn {...props} isDropdownButton isActive={props.isExpanded} />
);
