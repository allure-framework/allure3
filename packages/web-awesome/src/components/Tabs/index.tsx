import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useState } from "preact/hooks";
import { setTreeStatus } from "@/stores/tree";
import type { AwesomeStatus } from "../../../types";
import * as styles from "./styles.scss";

type TabsContextT = {
  currentTab: string | undefined;
  setCurrentTab: (tab: string) => void;
};

const TabsContext = createContext<TabsContextT | null>(null);

export const useTabsContext = () => {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs' components must be used within a Tabs component");
  }

  return context;
};

export const TabsProvider = (props: { initialTab?: string; children: ComponentChildren }) => {
  const { children, initialTab } = props;
  const [currentTab, setCurrentTab] = useState<string | undefined>(initialTab);

  return <TabsContext.Provider value={{ currentTab, setCurrentTab }}>{children}</TabsContext.Provider>;
};

export const Tabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  return <TabsProvider {...props} />;
};

export const TabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const Tab = (props: { id: string; children: ComponentChildren }) => {
  const { id, children, ...rest } = props;
  const { currentTab, setCurrentTab } = useTabsContext();
  const isCurrentTab = currentTab === id;
  const handleTabClick = () => {
    if (isCurrentTab) {
      setCurrentTab("total");
      setTreeStatus("total");
      return;
    }

    setCurrentTab(id);
    setTreeStatus(id as AwesomeStatus);
  };

  return (
    <button {...rest} className={styles.tab} onClick={handleTabClick} aria-current={isCurrentTab ? true : undefined}>
      <Text type="paragraph" size="m" bold>
        {children}
      </Text>
    </button>
  );
};
