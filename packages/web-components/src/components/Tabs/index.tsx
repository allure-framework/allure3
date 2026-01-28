import type { Signal } from "@preact/signals";
import { useComputed, useSignal } from "@preact/signals";
import { type ComponentChildren, createContext } from "preact";
import { useCallback, useContext } from "preact/hooks";
import { Text } from "../Typography";
import styles from "./styles.scss";

type TabsContextT = {
  currentTab: Signal<string | undefined>;
  setCurrentTab: (id: string) => void;
};

const TabsContext = createContext<TabsContextT | null>(null);

export const useTabsContext = () => {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("NavTabs components must be used within a NavTabs component");
  }

  return context;
};

export const TabsProvider = (props: { initialTab?: string; children: ComponentChildren }) => {
  const { children, initialTab } = props;
  const currentTab = useSignal<string | undefined>(initialTab);

  const setCurrentTab = useCallback(
    (id: string) => {
      currentTab.value = id;
    },
    [currentTab],
  );

  return <TabsContext.Provider value={{ currentTab, setCurrentTab }}>{children}</TabsContext.Provider>;
};

export const Tabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  return <TabsProvider {...props} />;
};

export const TabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.list}>{props.children}</div>;
};

export const Tab = (props: {
  tabId: string;
  children: ComponentChildren;
  onClick?: () => void;
  testId?: string;
  isCurrentTab?: boolean;
}) => {
  const { currentTab, setCurrentTab } = useTabsContext();
  const isContextCurrentTab = useComputed(() => currentTab.value === props.tabId);

  const { tabId, children, onClick, testId, isCurrentTab = isContextCurrentTab.value } = props;

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }

    if (onClick) {
      return onClick();
    }

    setCurrentTab(tabId);
  };

  return (
    <button
      className={styles.tab}
      onClick={handleTabClick}
      data-testid={testId || `tab-${tabId}`}
      aria-current={isCurrentTab || undefined}
    >
      <Text type="paragraph" size="m" bold={isCurrentTab}>
        {children}
      </Text>
    </button>
  );
};
