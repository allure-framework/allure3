import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { clsx } from "clsx";
import { type ComponentChildren, type FunctionalComponent, type VNode, createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import check from "@/assets/svg/line-general-check.svg";
import { SvgIcon } from "@/components/SvgIcon";
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
  size?: "s" | "m" | "l" | "xl";
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
  leadingIcon?: string;
  rightSlot?: ComponentChildren;
  closeMenuOnClick?: boolean;
  ariaLabel?: string;
  setIsOpened?: (isOpened: boolean) => void;
  dataTestId?: string;
};

const MenuItem: FunctionalComponent<ItemProps> = (props) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { setIsOpened } = useMenuContext();
  const { children, onClick, leadingIcon, rightSlot, ariaLabel, closeMenuOnClick = true, dataTestId, ...rest } = props;
  const isInteractive = typeof onClick === "function";
  const hasLeadingIcon = typeof leadingIcon === "string";
  const handleItemClick = (e: MouseEvent) => {
    if (isInteractive && closeMenuOnClick) {
      e.stopPropagation();
      setIsOpened(false);
    }

    if (isInteractive) {
      onClick?.();
    }
  };

  return (
    <li className={styles.menuListItem} {...rest}>
      <Text
        aria-label={ariaLabel}
        type="paragraph"
        size="m"
        tag={isInteractive ? "button" : "div"}
        className={clsx(styles.menuItem, isInteractive && styles.interactive)}
        onClick={handleItemClick}
        data-interactive-menu-item={isInteractive ? true : undefined}
        data-testid={dataTestId}
      >
        {hasLeadingIcon && <SvgIcon id={leadingIcon} className={styles.leadingIcon} size="m" />}
        <div className={styles.content}>{children}</div>
        {rightSlot && <div className={styles.right}>{rightSlot}</div>}
      </Text>
    </li>
  );
};

Menu.Item = MenuItem;
Menu.Item.displayName = "Menu.Item";

const MenuItemWithCheckmark: FunctionalComponent<Omit<ItemProps, "rightSlot"> & { isChecked: boolean }> = (props) => {
  const { isChecked = false, ...itemProps } = props;
  return (
    <MenuItem {...itemProps} rightSlot={isChecked && <SvgIcon className={styles.checkmarkIcon} id={check.id} />} />
  );
};

Menu.ItemWithCheckmark = MenuItemWithCheckmark;
Menu.ItemWithCheckmark.displayName = "Menu.ItemWithCheckmark";
