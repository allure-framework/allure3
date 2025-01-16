import { Text } from "@allurereport/web-components";
import { type ComponentChildren } from "preact";
import { currentTab, setCurrentTab } from "@/stores/tabs";
import * as styles from "./styles.scss";

export const Tabs = (props: { children: ComponentChildren; initialTab?: string }) => {
  if (props.initialTab) {
    setCurrentTab(props.initialTab);
  }
  return <>{props.children}</>;
};

export const TabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const Tab = (props: { id: string; children: ComponentChildren }) => {
  const { id, children, ...rest } = props;
  const isCurrentTab = currentTab.value === id;

  return (
    <button
      {...rest}
      className={styles.tab}
      onClick={() => setCurrentTab(id)}
      aria-current={isCurrentTab ? true : undefined}
    >
      <Text type="paragraph" size="m" bold>
        {children}
      </Text>
    </button>
  );
};
