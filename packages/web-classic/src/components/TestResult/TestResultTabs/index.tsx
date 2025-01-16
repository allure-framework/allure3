import { Text } from "@allurereport/web-components";
import { type ComponentChildren, createContext } from "preact";
import { useContext, useState } from "preact/hooks";
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
  const { id, children } = props;
  const { currentTab, setCurrentTab } = useTestResultTabsContext();
  const isCurrentTab = currentTab === id;

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }
    setCurrentTab(id);
  };

  return (
    <button className={styles.tab} onClick={handleTabClick} aria-current={isCurrentTab ? true : undefined}>
      <Text type="paragraph" size="m">
        {children}
      </Text>
    </button>
  );
};
