import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { navigateTo, route } from "@/stores/router";
import { resolveTestResultTab, selectedTestResultTab } from "@/stores/testResultTab";
import { getTestResultTabHash } from "@/utils/testResultNavigation";

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

export const TestResultTabsProvider = (props: {
  initialTab?: string;
  isTabAvailable?: (id: string) => boolean;
  children: ComponentChildren;
}) => {
  const { children, initialTab, isTabAvailable } = props;
  const [localTab, setLocalTab] = useState<string | undefined>(initialTab);
  // when availability is known, the tab is taken from the URL, so a reload and prev/next navigation keep it
  const selectedTab = isTabAvailable ? selectedTestResultTab.value : localTab;
  const currentTab = isTabAvailable ? resolveTestResultTab(selectedTab, isTabAvailable, initialTab) : selectedTab;
  const setCurrentTab = (id: string) => {
    if (isTabAvailable) {
      const hash = getTestResultTabHash(route.value, id);

      if (hash) {
        navigateTo(hash);
      }
      return;
    }

    setLocalTab(id);
  };

  return (
    <TestResultTabsContext.Provider value={{ currentTab, setCurrentTab }}>{children}</TestResultTabsContext.Provider>
  );
};

export const TestResultTabs = (props: {
  children: ComponentChildren;
  initialTab?: string;
  isTabAvailable?: (id: string) => boolean;
}) => {
  return <TestResultTabsProvider {...props} />;
};

export const TestResultTabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const TestResultTab = (props: { id: string; children: ComponentChildren; disabled?: boolean }) => {
  const { id, children, disabled = false } = props;
  const { currentTab, setCurrentTab } = useTestResultTabsContext();
  const isCurrentTab = currentTab === id;

  const handleTabClick = () => {
    if (isCurrentTab || disabled) {
      return;
    }
    setCurrentTab(id);
  };

  return (
    <button
      className={styles.tab}
      onClick={handleTabClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-current={isCurrentTab ? true : undefined}
      data-testid={`test-result-tab-${id}`}
    >
      <Text type="paragraph" size="m">
        {children}
      </Text>
    </button>
  );
};
