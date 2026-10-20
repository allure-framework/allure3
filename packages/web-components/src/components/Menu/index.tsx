import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { clsx } from "clsx";
import { type ComponentChildren, type FunctionalComponent, type VNode, createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";

import styles from "./styles.scss";

type MenuContextT = {
  setIsOpened: (isOpened: boolean) => void;
};

const MenuContext = createContext<MenuContextT | null>(null);

const useMenuContext = () => {
  const context = useContext(MenuContext);

  if (!context) {
    throw new Error("useMenuContext must be used within a Menu");
  }

  return context;
};

export const Menu = (props: {
  children: ComponentChildren;
  isInitialOpened?: boolean;
  size?: "xs" | "s" | "m" | "l" | "xl";
  placement?: "bottom-start" | "bottom-end";
  menuTrigger: (props: { onClick: () => void; isOpened: boolean; setIsOpened: (isOpened: boolean) => void }) => VNode;
  menuTriggerWrapper?: "div" | "span";
}) => {
  const {
    children,
    menuTrigger,
    menuTriggerWrapper: MenuTriggerWrapper = "div",
    size = "m",
    isInitialOpened = false,
    placement = "bottom-end",
    ...rest
  } = props;
  const [isOpened, setIsOpened] = useState(isInitialOpened);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const handleTriggerClick = () => {
    setIsOpened(!isOpened);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpened) {
        setIsOpened(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpened]);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isOpened) {
        return;
      }

      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(e.target as Node)) {
        setIsOpened(false);
      }
    };

    if (isOpened) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpened]);
  useEffect(() => {
    const updatePosition = () => {
      if (!menuRef.current && !triggerRef.current) {
        return;
      }

      // @ts-ignore
      computePosition(triggerRef.current, menuRef.current, {
        placement,
        middleware: [offset(6), flip(), shift({ padding: 5 })],
        strategy: "fixed",
      }).then(({ x, y, strategy }) => {
        if (menuRef.current) {
          Object.assign(menuRef.current.style, {
            left: `${x}px`,
            top: `${y}px`,
            position: strategy,
            zIndex: 1000,
          });
        }
      });
    };

    updatePosition();
    // @ts-ignore
    return autoUpdate(triggerRef.current, menuRef.current, updatePosition);
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [menuRef.current, triggerRef.current]);

  return (
    <MenuContext.Provider
      value={{
        setIsOpened,
      }}
    >
      <>
        {typeof menuTrigger === "function" && (
          <MenuTriggerWrapper ref={triggerRef}>
            {menuTrigger({
              isOpened,
              onClick: handleTriggerClick,
              setIsOpened,
            })}
          </MenuTriggerWrapper>
        )}
        {createPortal(
          <div ref={menuRef} {...rest}>
            {isOpened && <aside className={clsx(styles.menu, styles[`size-${size}`])}>{children}</aside>}
          </div>,
          document.body,
        )}
      </>
    </MenuContext.Provider>
  );
};

const MenuSection: FunctionalComponent = (props) => {
  const { children, ...rest } = props;

  return (
    <ul className={styles.section} {...rest}>
      {children}
    </ul>
  );
};

Menu.Section = MenuSection;

Menu.Section.displayName = "Menu.Section";

type ItemProps = {
  children: ComponentChildren;
  onClick?: () => void;
  /**
   * Makes the whole item an external link, which is opened in a new tab
   */
  href?: string;
  leadingIcon?: string;
  /**
   * The icon fills its whole box (a logo), so it is scaled down to look of the same size as the line icons in the xs menu
   */
  leadingIconFilled?: boolean;
  /**
   * The value which is copied to the clipboard by a click, when the item is neither a link nor a button:
   * the icon of copying appears on hover and turns to a checkmark for a moment after the value is copied
   */
  copyValue?: string;
  rightSlot?: ComponentChildren;
  /**
   * The right slot is shown only when the item is hovered or focused, it keeps its place in the layout
   */
  showRightSlotOnHover?: boolean;
  closeMenuOnClick?: boolean;
  ariaLabel?: string;
  setIsOpened?: (isOpened: boolean) => void;
  dataTestId?: string;
};

const COPIED_TIMEOUT = 1500;

const MenuItem: FunctionalComponent<ItemProps> = (props) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { setIsOpened } = useMenuContext();
  const {
    children,
    onClick,
    href,
    leadingIcon,
    leadingIconFilled = false,
    copyValue,
    rightSlot: customRightSlot,
    showRightSlotOnHover: customShowRightSlotOnHover = false,
    ariaLabel,
    closeMenuOnClick: customCloseMenuOnClick = true,
    dataTestId,
    ...rest
  } = props;
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimer = useRef<number>();
  const isLink = typeof href === "string";
  const isCopyable = typeof copyValue === "string" && !isLink && typeof onClick !== "function";

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copy = async () => {
    // there is no clipboard in an insecure context, and it is better to show nothing than a checkmark of a failed copy
    if (!isCopyable || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
    } catch {
      return;
    }

    setIsCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setIsCopied(false), COPIED_TIMEOUT);
  };

  const handleClick = isCopyable ? copy : onClick;
  const closeMenuOnClick = isCopyable ? false : customCloseMenuOnClick;
  const rightSlot = isCopyable ? (
    <SvgIcon id={isCopied ? allureIcons.lineGeneralCheck : allureIcons.lineGeneralCopy3} />
  ) : (
    customRightSlot
  );
  // the checkmark of the copied value stays visible until it disappears
  const showRightSlotOnHover = isCopyable ? !isCopied : customShowRightSlotOnHover;
  const isInteractive = typeof handleClick === "function" || isLink;
  const hasLeadingIcon = typeof leadingIcon === "string";
  const handleItemClick = (e: MouseEvent) => {
    if (isInteractive && closeMenuOnClick) {
      e.stopPropagation();

      if (isLink) {
        // the link is followed after the handlers, the menu is re-rendered in a microtask before that,
        // and the link which is removed from the page is not followed at all
        window.setTimeout(() => setIsOpened(false), 0);
      } else {
        setIsOpened(false);
      }
    }

    if (isInteractive) {
      handleClick?.();
    }
  };

  return (
    <li className={styles.menuListItem} {...rest}>
      <Text
        aria-label={ariaLabel}
        type="paragraph"
        size="m"
        tag={isLink ? "a" : isInteractive ? "button" : "div"}
        href={href}
        target={isLink ? "_blank" : undefined}
        rel={isLink ? "noopener noreferrer" : undefined}
        className={clsx(styles.menuItem, isInteractive && styles.interactive)}
        onClick={handleItemClick}
        data-interactive-menu-item={isInteractive ? true : undefined}
        data-testid={dataTestId}
      >
        {hasLeadingIcon && (
          <SvgIcon
            id={leadingIcon}
            className={clsx(styles.leadingIcon, leadingIconFilled && styles.leadingIconFilled)}
            size="m"
          />
        )}
        <div className={styles.content}>{children}</div>
        {rightSlot && (
          <div className={clsx(styles.right, showRightSlotOnHover && styles.rightOnHover)}>{rightSlot}</div>
        )}
      </Text>
    </li>
  );
};

Menu.Item = MenuItem;
Menu.Item.displayName = "Menu.Item";

const MenuItemWithCheckmark: FunctionalComponent<Omit<ItemProps, "rightSlot"> & { isChecked: boolean }> = (props) => {
  const { isChecked = false, ...itemProps } = props;
  return (
    <MenuItem
      {...itemProps}
      rightSlot={isChecked && <SvgIcon className={styles.checkmarkIcon} id={allureIcons.lineGeneralCheck} />}
    />
  );
};

Menu.ItemWithCheckmark = MenuItemWithCheckmark;
Menu.ItemWithCheckmark.displayName = "Menu.ItemWithCheckmark";
