import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { activeTab, navigateTo, route } from "@/stores/router";
import * as styles from "./styles.scss";

type TestResultTabsContextT = {
  currentTab: string | undefined;
  setCurrentTab: (id: string) => void;
};

const TestResultTabsContext = createContext<TestResultTabsContextT | null>(null);

export const useTestResultTabsContext = () => {
  const context = useContext(TestResultTabsContext);

  if (!context) {
    throw new Error("TestResultTabs components must be used within a TestResultTabs component");
  }

  return context;
};

export const TestResultTabsProvider = (props: { initialTab?: string; children: ComponentChildren }) => {
  const { children, initialTab } = props;
  const [currentTab, setCurrentTab] = useState<string | undefined>(initialTab);

  return (
    <TestResultTabsContext.Provider value={{ currentTab, setCurrentTab }}>{children}</TestResultTabsContext.Provider>
  );
};

export const TestResultTabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  return <TestResultTabsProvider {...props} />;
};

export const TestResultTabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const TestResultTab = (props: { id: string; children: ComponentChildren; disabled?: boolean }) => {
  const { currentTab, setCurrentTab } = useTestResultTabsContext();
  const { id, children } = props;
  const isActiveFromUrl = activeTab.value === id;
  const isCurrentTab = isActiveFromUrl ? isActiveFromUrl : currentTab === id;

  useEffect(() => {
    if (isActiveFromUrl) {
      setCurrentTab(id);
    }
  }, [activeTab.value]);

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }
    setCurrentTab(id);
    navigateTo({ ...route.value, params: { ...route.value.params, tabName: id !== "overview" ? id : "" } });
  };

  return (
    <button className={styles.tab} onClick={handleTabClick} aria-current={isCurrentTab ? true : undefined}>
      <Text type="paragraph" size="m">
        {children}
      </Text>
    </button>
  );
};
