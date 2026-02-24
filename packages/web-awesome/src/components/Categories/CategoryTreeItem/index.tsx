import type { CategoryNode, CategoryNodeProps, TestCategories } from "@allurereport/core-api";
import { IconButton, TreeItem, allureIcons } from "@allurereport/web-components";
import type { FC } from "preact/compat";
import { useState } from "preact/hooks";
import { CategoryHeaderItem } from "@/components/Categories/CategoryHeaderItem";
import { GroupTreeItem } from "@/components/Categories/GroupTreeItem";
import { HistoryTreeItem } from "@/components/Categories/HistoryTreeItem";
import { LabelTreeItem } from "@/components/Categories/LabelTreeItem";
import { MessageTreeItem } from "@/components/Categories/MessageTreeItem";
import { SeverityTreeItem } from "@/components/Categories/SeverityTreeItem";
import { reportStatsStore } from "@/stores";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import * as styles from "./styles.scss";

type CategoryTreeItemProps = CategoryNodeProps & {
  order?: number;
  depth?: number;
};

const getDefaultOpened = (node?: CategoryNode) => (node?.type === "category" ? Boolean(node.expand) : true);

const getSubtreeExpandableIds = (rootId: string, store: TestCategories) => {
  const result: string[] = [];
  const stack = [rootId];

  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId) {
      continue;
    }
    const currentNode = store.nodes[currentId];
    if (!currentNode) {
      continue;
    }
    if (currentNode.childrenIds?.length) {
      result.push(currentId);
    }
    (currentNode.childrenIds ?? []).forEach((childId: string) => stack.push(childId));
  }

  return result;
};

const getNodeOpenedState = (nodeId: string, store: TestCategories) => {
  const node = store.nodes[nodeId];
  const defaultOpened = getDefaultOpened(node);
  return collapsedTrees.value.has(nodeId) ? !defaultOpened : defaultOpened;
};

export const CategoryTreeItem: FC<CategoryTreeItemProps> = ({ nodeId, store, order, depth = 0 }) => {
  const node: CategoryNode = store.nodes[nodeId];
  const trId = currentTrId.value;
  const { t: tTransitions } = useI18n("transitions");
  const { t: tEnvironments } = useI18n("environments");
  const { t: tEmpty } = useI18n("empty");
  const hasSavedState = collapsedTrees.value.has(nodeId);
  const defaultOpened = getDefaultOpened(node);
  const [isOpened, setIsOpen] = useState<boolean>(hasSavedState ? !defaultOpened : defaultOpened);
  const [subtreeVersion, setSubtreeVersion] = useState(0);
  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<"first" | "all" | "none" | null>(null);

  if (!node) {
    return null;
  }

  const hasChildren = Boolean(node.childrenIds?.length);
  const hasOnlyLeafResults = hasChildren
    ? (node.childrenIds ?? []).every((childId) => store.nodes[childId]?.type === "tr")
    : false;
  const expandableNodeIds = hasChildren ? getSubtreeExpandableIds(nodeId, store) : [];
  const isSubtreeCollapsedAll = !getNodeOpenedState(nodeId, store);
  const isSubtreeFirstLevelOnly =
    getNodeOpenedState(nodeId, store) &&
    expandableNodeIds.filter((id) => id !== nodeId).every((id) => !getNodeOpenedState(id, store));
  const isSubtreeExpandedAll =
    getNodeOpenedState(nodeId, store) && expandableNodeIds.every((id) => getNodeOpenedState(id, store));

  const onClick = () => {
    setIsOpen(!isOpened);
    toggleTree(nodeId);
    setLastSubtreeToggle(null);
  };

  const setSubtreeState = (state: "first" | "all" | "none") => {
    const nextCollapsed = new Set(collapsedTrees.value);

    expandableNodeIds.forEach((id) => {
      const currentNode = store.nodes[id];
      const isDefaultOpened = getDefaultOpened(currentNode);
      const isRoot = id === nodeId;
      let shouldBeOpened = false;

      if (state === "all") {
        shouldBeOpened = true;
      } else if (state === "first") {
        shouldBeOpened = isRoot;
      } else {
        shouldBeOpened = false;
      }

      if (isDefaultOpened === shouldBeOpened) {
        nextCollapsed.delete(id);
      } else {
        nextCollapsed.add(id);
      }
    });

    collapsedTrees.value = nextCollapsed;
  };

  const onToggleSubtree = (event: MouseEvent) => {
    event.stopPropagation();
    if (hasOnlyLeafResults) {
      if (isSubtreeCollapsedAll) {
        setSubtreeState("all");
        setIsOpen(true);
        setLastSubtreeToggle("all");
      } else {
        setSubtreeState("none");
        setIsOpen(false);
        setLastSubtreeToggle("none");
      }
      setSubtreeVersion((value: number) => value + 1);
      return;
    }
    let nextState: "first" | "all" | "none" = "first";
    if (isSubtreeCollapsedAll) {
      nextState = "first";
    } else if (isSubtreeFirstLevelOnly) {
      nextState = lastSubtreeToggle === "all" ? "none" : "all";
    } else if (isSubtreeExpandedAll) {
      nextState = "first";
    } else {
      nextState = "all";
    }
    setSubtreeState(nextState);
    setIsOpen(nextState !== "none");
    setLastSubtreeToggle(nextState);
    setSubtreeVersion((value: number) => value + 1);
  };

  const subtreeToggleIcon = (() => {
    if (hasOnlyLeafResults) {
      return isSubtreeCollapsedAll ? allureIcons.lineArrowsChevronDown : allureIcons.lineArrowsChevronUp;
    }
    if (isSubtreeCollapsedAll) {
      return allureIcons.lineArrowsChevronDown;
    }
    if (isSubtreeFirstLevelOnly) {
      return allureIcons.lineArrowsChevronDownDouble;
    }
    return allureIcons.lineArrowsChevronUpDouble;
  })();

  const subtreeToggle = hasChildren ? (
    <IconButton
      size="xs"
      style="ghost"
      icon={subtreeToggleIcon}
      onClick={onToggleSubtree}
      className={styles["tree-item-subtree-toggle"]}
    />
  ) : null;

  const renderChildren = () => (
    <div className={styles["tree-children"]} key={subtreeVersion}>
      {(node.childrenIds ?? []).map((cid: string, index: number) => (
        <div key={cid} className={styles["tree-content"]} data-tree-content>
          <CategoryTreeItem key={cid} nodeId={cid} store={store} order={index} depth={depth + 1} />
        </div>
      ))}
    </div>
  );

  if (node.type === "category") {
    return (
      <CategoryHeaderItem
        node={node}
        nodeId={nodeId}
        store={store}
        isOpened={isOpened}
        onToggle={onClick}
        depth={depth}
        subtreeToggle={subtreeToggle}
        reportStatistic={reportStatsStore.value.data}
      >
        {renderChildren()}
      </CategoryHeaderItem>
    );
  }
  if (node.type === "history") {
    return (
      <HistoryTreeItem
        node={node}
        nodeId={nodeId}
        store={store}
        isOpened={isOpened}
        onToggle={onClick}
        depth={depth}
        subtreeToggle={subtreeToggle}
        reportStatistic={reportStatsStore.value.data}
      >
        {renderChildren()}
      </HistoryTreeItem>
    );
  }
  if (node.type === "message" || node.type === "group") {
    if (node.type === "message") {
      return (
        <MessageTreeItem
          node={node}
          nodeId={nodeId}
          store={store}
          isOpened={isOpened}
          onToggle={onClick}
          depth={depth}
          subtreeToggle={subtreeToggle}
          reportStatistic={reportStatsStore.value.data}
        >
          {renderChildren()}
        </MessageTreeItem>
      );
    }
    if (node.key === "severity") {
      return (
        <SeverityTreeItem
          node={node}
          nodeId={nodeId}
          store={store}
          isOpened={isOpened}
          onToggle={onClick}
          depth={depth}
          subtreeToggle={subtreeToggle}
          reportStatistic={reportStatsStore.value.data}
        >
          {renderChildren()}
        </SeverityTreeItem>
      );
    }
    if (node.key) {
      return (
        <LabelTreeItem
          node={node}
          nodeId={nodeId}
          store={store}
          isOpened={isOpened}
          onToggle={onClick}
          depth={depth}
          subtreeToggle={subtreeToggle}
          reportStatistic={reportStatsStore.value.data}
        >
          {renderChildren()}
        </LabelTreeItem>
      );
    }
    return (
      <GroupTreeItem
        node={node}
        nodeId={nodeId}
        store={store}
        isOpened={isOpened}
        onToggle={onClick}
        depth={depth}
        subtreeToggle={subtreeToggle}
        reportStatistic={reportStatsStore.value.data}
      >
        {renderChildren()}
      </GroupTreeItem>
    );
  }
  if (node.type === "tr") {
    const isEnvLeaf = node.key === "environment";
    let envValue = node.value ?? node.name;
    if (typeof envValue === "string" && envValue.toLowerCase().startsWith("environment:")) {
      envValue = envValue.slice("environment:".length).trim();
    }
    if (node.value === "<Empty>") {
      envValue = tEmpty("no-environment");
    }
    const displayName = isEnvLeaf ? `${tEnvironments("environment", { count: 1 })}: ${envValue}` : node.name;
    const leafTooltips =
      node.type === "tr"
        ? {
            transition:
              node.tooltips?.transition ??
              (node.transition ? tTransitions(`description.${node.transition}`) : undefined),
            flaky: node.tooltips?.flaky ?? (node.flaky ? tTransitions("description.flaky") : undefined),
            retries:
              node.tooltips?.retries ??
              (node.retriesCount ? tTransitions("description.retries", { count: node.retriesCount }) : undefined),
          }
        : node.tooltips;
    return (
      <div className={styles["tree-item"]} id={nodeId}>
        <TreeItem
          {...node}
          name={displayName}
          groupOrder={(order ?? 0) + 1}
          marked={node.id === trId}
          navigateTo={() => navigateToTestResult({ testResultId: nodeId })}
          tooltips={leafTooltips}
        />
      </div>
    );
  }
};
