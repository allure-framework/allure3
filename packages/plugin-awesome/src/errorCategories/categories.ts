import type {
  CategoriesStore,
  CategoryNode,
  ErrorCategoriesMode,
  ErrorCategoryNormalized,
  Statistic,
  TestStatus,
} from "@allurereport/core-api";
import { incrementStatistic } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import type { AwesomeDataWriter } from "../writer.js";
import { extractMatchingData } from "./extract.js";
import { matchCategories } from "./matchers.js";

const emptyStat = (): Statistic => ({
  total: 0,
});

const DEFAULT_PRODUCT = "Product defects";
const DEFAULT_TEST = "Test defects";

const msgKey = (m?: string) => (m && m.trim().length ? m : "(empty message)");

const applyCategoryNames = (status: TestStatus, matchedNames: string[]): string[] => {
  if (matchedNames.length) {
    return matchedNames;
  }
  if (status === "failed") {
    return [DEFAULT_PRODUCT];
  }
  if (status === "broken") {
    return [DEFAULT_TEST];
  }
  return [];
};

const stableCategoryOrder = (configCats: readonly ErrorCategoryNormalized[]): string[] => {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const c of configCats) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      order.push(c.name);
    }
  }
  if (!seen.has(DEFAULT_PRODUCT)) {
    order.push(DEFAULT_PRODUCT);
  }
  if (!seen.has(DEFAULT_TEST)) {
    order.push(DEFAULT_TEST);
  }
  return order;
};

export const generateCategories = async (
  writer: AwesomeDataWriter,
  tests: AwesomeTestResult[],
  normalizedConfigCats: ErrorCategoryNormalized[],
  mode: ErrorCategoriesMode = "first",
  filename = "categories.json",
) => {
  const visible = tests.filter((t) => !t.hidden);

  // catName -> message -> trs
  const byCategory = new Map<string, Map<string, AwesomeTestResult[]>>();
  const catStats = new Map<string, Statistic>();
  const msgStats = new Map<string, Map<string, Statistic>>();

  for (const tr of visible) {
    const d = extractMatchingData(tr);

    const matched = matchCategories(normalizedConfigCats, d, mode);
    const matchedNames = matched.map((c) => c.name);

    const categoryNames = applyCategoryNames(d.status, matchedNames);
    if (!categoryNames.length) {
      continue;
    }

    const message = msgKey(d.message);

    for (const catName of categoryNames) {
      let msgMap = byCategory.get(catName);
      if (!msgMap) {
        msgMap = new Map();
        byCategory.set(catName, msgMap);
      }
      let arr = msgMap.get(message);
      if (!arr) {
        arr = [];
        msgMap.set(message, arr);
      }
      arr.push(tr);

      const cs = catStats.get(catName) ?? emptyStat();
      incrementStatistic(cs, tr.status);
      catStats.set(catName, cs);

      let msMap = msgStats.get(catName);
      if (!msMap) {
        msMap = new Map();
        msgStats.set(catName, msMap);
      }
      const ms = msMap.get(message) ?? emptyStat();
      incrementStatistic(ms, tr.status);
      msMap.set(message, ms);
    }
  }

  const orderedCats = stableCategoryOrder(normalizedConfigCats).filter((name) => byCategory.has(name));

  const nodes: Record<string, CategoryNode> = {};
  const roots: string[] = [];

  const duplicateChecker = (node: CategoryNode) => {
    nodes[node.id] ??= node;
    return nodes[node.id];
  };

  const attachToCat = (parentId: string, childId: string) => {
    const p = nodes[parentId];
    p.childrenIds ??= [];
    if (!p.childrenIds.includes(childId)) {
      p.childrenIds.push(childId);
    }
  };

  for (const catName of orderedCats) {
    const catId = `cat:${md5(catName)}`;
    roots.push(catId);

    duplicateChecker({
      id: catId,
      type: "category",
      name: catName,
      statistic: catStats.get(catName) ?? emptyStat(),
      childrenIds: [],
    });

    const msgMap = byCategory.get(catName)!;
    const msMap = msgStats.get(catName) ?? new Map();
    const messages = Array.from(msgMap.keys()).sort((a, b) => a.localeCompare(b));

    for (const message of messages) {
      const msgId = `msg:${md5(`${catName}\n${message}`)}`;

      duplicateChecker({
        id: msgId,
        type: "message",
        name: message,
        statistic: msMap.get(message) ?? emptyStat(),
        childrenIds: [],
      });

      attachToCat(catId, msgId);

      const trs = msgMap.get(message)!;
      const ids = trs.map((t) => t.id).sort((a, b) => a.localeCompare(b));

      for (const trId of ids) {
        const tr = trs.find((t) => t.id === trId)!;
        const { status, duration, flaky } = tr;

        duplicateChecker({
          id: tr.id,
          type: "tr",
          name: tr.name,
          status,
          duration,
          flaky,
        });

        attachToCat(msgId, tr.id);
      }
    }
  }

  const store: CategoriesStore = { roots, nodes };
  await writer.writeWidget(filename, store);
};
