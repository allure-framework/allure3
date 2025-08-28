import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useState } from "preact/hooks";
import * as styles from "./styles.scss";

type NavTabsContextT = {
  currentTab: string | undefined;
  setCurrentTab: (id: string) => void;
};

const NavTabsContext = createContext<NavTabsContextT | null>(null);

export const useNavTabsContext = () => {
  const context = useContext(NavTabsContext);

  if (!context) {
    throw new Error("NavTabs components must be used within a NavTabs component");
  }

  return context;
};

export const NavTabsProvider = (props: { initialTab?: string; children: ComponentChildren }) => {
  const { children, initialTab } = props;
  const [currentTab, setCurrentTab] = useState<string | undefined>(initialTab);

  return <NavTabsContext.Provider value={{ currentTab, setCurrentTab }}>{children}</NavTabsContext.Provider>;
};

export const NavTabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  return <NavTabsProvider {...props} />;
};

export const NavTabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const NavTab = (props: {
  "id": string;
  "children": ComponentChildren;
  "onClick"?: () => void;
  "data-testid"?: string;
  "isCurrentTab"?: boolean;
}) => {
  const { currentTab, setCurrentTab } = useNavTabsContext();
  const { id, children, onClick, "data-testid": dataTestId, "isCurrentTab": overrideIsCurrentTab } = props;
  const isCurrentTab = overrideIsCurrentTab !== undefined ? overrideIsCurrentTab : currentTab === id;
  const handleTabClick = () => {
    if (onClick) {
      onClick();
    } else if (isCurrentTab) {
      return;
    } else {
      setCurrentTab(id);
    }
  };

  return (
    <button
      className={styles.tab}
      onClick={handleTabClick}
      data-testid={dataTestId || `nav-tab-${id}`}
      aria-current={isCurrentTab ? true : undefined}
    >
      <Text type="paragraph" size="m">
        {children}
      </Text>
    </button>
  );
};
