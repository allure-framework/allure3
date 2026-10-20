import { Text } from "@allurereport/web-components";
import { type ComponentChildren } from "preact";

import { currentTab, setCurrentTab } from "@/stores/tabs";

import * as styles from "./styles.scss";

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
