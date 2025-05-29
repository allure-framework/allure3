import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { activeSubTab, activeTab, navigateTo, route } from "@/stores/router";
import * as styles from "./styles.scss";

type TrTabsContextT = {
  currentTab: string | undefined;
  setCurrentTab: (id: string) => void;
};

const TestResultTabsContext = createContext<TrTabsContextT | null>(null);

export const useTestResultTabsContext = () => {
  const context = useContext(TestResultTabsContext);

  if (!context) {
    throw new Error("TestResultTabs components must be used within a TrTabs component");
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

export const TrTabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  return <TestResultTabsProvider {...props} />;
};

export const TrTabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const TrTab = (props: { id: string; children: ComponentChildren }) => {
  const { testResultId } = route.value.params;
  const { currentTab, setCurrentTab } = useTestResultTabsContext();
  const { id, children } = props;
  const isActiveFromUrl = activeSubTab.value === id;
  const isCurrentTab = isActiveFromUrl ? isActiveFromUrl : currentTab === id;

  useEffect(() => {
    if (isActiveFromUrl) {
      setCurrentTab(id);
    }
  }, [activeSubTab.value]);

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }
    setCurrentTab(id);
    navigateTo({
      ...route.value,
      params: {
        testResultId,
        subTab: id || null,
      },
    });
  };

  return (
    <button
      className={styles.tab}
      onClick={handleTabClick}
      data-testid={`test-result-tab-${id}`}
      aria-current={isCurrentTab ? true : undefined}
    >
      <Text type="paragraph" size="m">
        {children}
      </Text>
    </button>
  );
};
