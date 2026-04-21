import { IconButton, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import {
  collectExpandableStepNodes,
  getNextSubtreeToggleState,
  getSubtreeToggleIcon,
  getStepTreeExpansionPolicy,
  hasFailedStepContext,
  isSubtreeFirstLevelOnlyOpened,
  isOpenByDefaultForPolicy,
  type SubtreeNode,
  type SubtreeToggleState,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";
import { TrBodyItems } from "@/components/TestResult/TrSteps/TrBodyItems";
import { useI18n } from "@/stores/locale";
import { isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

const iconBySubtreeState = {
  "single-down": allureIcons.lineArrowsChevronDown,
  "single-up": allureIcons.lineArrowsChevronUp,
  "double-down": allureIcons.lineArrowsChevronDownDouble,
  "double-up": allureIcons.lineArrowsChevronUpDouble,
} as const;

export type TrStepsProps = {
  bodyItems: TrBodyItem[];
  id?: string;
};

export const TrSteps: FunctionalComponent<TrStepsProps> = ({ bodyItems, id }) => {
  const stepsId = typeof id === "string" ? `${id}-steps` : null;
  const policy = getStepTreeExpansionPolicy();
  const openedByDefault = isOpenByDefaultForPolicy(policy, hasFailedStepContext(bodyItems));
  const isOpened = stepsId !== null ? isTreeOpened(stepsId, openedByDefault) : openedByDefault;
  const expandableTreeNodes = collectExpandableStepNodes(bodyItems, policy);
  const hasChildren = stepsId !== null && bodyItems.length > 0;
  const subtreeNodes: SubtreeNode[] = hasChildren
    ? [
        { id: stepsId, openedByDefault, isRoot: true },
        ...expandableTreeNodes.map((node) => ({ ...node, isRoot: false })),
      ]
    : [];
  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<SubtreeToggleState | null>(null);
  const isRootSubtreeOpened = stepsId !== null ? isTreeOpened(stepsId, openedByDefault) : false;
  const isSubtreeCollapsedAll = !isRootSubtreeOpened;
  const isSubtreeFirstLevelOnly =
    stepsId !== null ? isSubtreeFirstLevelOnlyOpened(stepsId, openedByDefault, subtreeNodes, isTreeOpened) : false;
  const isSubtreeExpandedAll = hasChildren && subtreeNodes.every((node) => isTreeOpened(node.id, node.openedByDefault));
  const hasOnlyLeafResults = hasChildren && subtreeNodes.every((node) => node.isRoot);
  const subtreeToggleIcon =
    iconBySubtreeState[
      getSubtreeToggleIcon({
        hasOnlyLeafResults,
        isSubtreeCollapsedAll,
        isSubtreeFirstLevelOnly,
      })
    ];

  const setSubtreeState = (state: SubtreeToggleState) => {
    subtreeNodes.forEach((node) => {
      const shouldOpenSubtree = state === "all" ? true : state === "first" ? node.isRoot : false;
      setTreeOpened(node.id, shouldOpenSubtree, node.openedByDefault);
    });
  };

  const handleToggleSubtree = (event: MouseEvent) => {
    event.stopPropagation();
    const nextState = getNextSubtreeToggleState({
      hasOnlyLeafResults,
      isSubtreeCollapsedAll,
      isSubtreeFirstLevelOnly,
      isSubtreeExpandedAll,
      lastSubtreeToggle,
    });
    setSubtreeState(nextState);
    if (nextState !== "first") {
      setLastSubtreeToggle(nextState);
    }
  };

  const toggleRoot = () => {
    if (stepsId === null) {
      return;
    }
    setLastSubtreeToggle(null);
    toggleTree(stepsId, openedByDefault);
  };

  const { t } = useI18n("execution");
  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        icon={allureIcons.lineHelpersPlayCircle}
        isOpened={isOpened}
        setIsOpen={toggleRoot}
        counter={bodyItems.length}
        title={t("body")}
        actions={
          hasChildren ? (
            <IconButton
              style="ghost"
              size="xs"
              icon={subtreeToggleIcon}
              onClick={handleToggleSubtree}
              data-testid="test-result-steps-subtree-toggle"
            />
          ) : null
        }
      />
      {isOpened && (
        <div data-testid="test-result-steps-root" className={styles["test-result-steps-root"]}>
          <TrBodyItems bodyItems={bodyItems} />
        </div>
      )}
    </div>
  );
};
