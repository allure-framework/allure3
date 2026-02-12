import { type ComponentChildren } from "preact";
import { NavTab, NavTabs, NavTabsList } from "@/components/NavTabs";
import { navigateToTestResultTab } from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";

export const TrTabs = NavTabs;
export const TrTabsList = NavTabsList;

export const TrTab = (props: { id: string; children: ComponentChildren }) => {
  const { id, children } = props;
  const isCurrentTab = trCurrentTab.value === id;

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }

    navigateToTestResultTab({ testResultId: currentTrId.value, tab: id });
  };

  return (
    <NavTab id={id} onClick={handleTabClick} data-testid={`test-result-tab-${id}`} isCurrentTab={isCurrentTab}>
      {children}
    </NavTab>
  );
};
