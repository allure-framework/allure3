import type { CategoryDefinition } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";

import type { TestOpsClient } from "../client.js";
import type { TestOpsPluginTestResult, UploadCategory } from "../model.js";
import { toUploadCategory } from "./categories.js";
import { unwrapStepsAttachments } from "./resolvers.js";

export const categoryDisplayName = (cat: UploadCategory): string =>
  cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId;

export const enrichWithCategories = async (
  store: AllureStore,
  trs: TestOpsPluginTestResult[],
  contextCategories: CategoryDefinition[],
): Promise<TestOpsPluginTestResult[]> => {
  return Promise.all(
    trs.map(async (tr) => {
      const environmentId = await store.environmentIdByTrId(tr.id);
      const base = {
        ...tr,
        ...(environmentId ? { environment: environmentId } : {}),
        steps: unwrapStepsAttachments(tr.steps),
      };
      const category = toUploadCategory(base, contextCategories ?? []);

      if (category) {
        base.category = category;
      }

      return base;
    }),
  );
};

const collectCategoryNamesByExternalId = (trs: TestOpsPluginTestResult[]): Map<string, string> => {
  const map = new Map<string, string>();

  for (const tr of trs) {
    const cat = tr.category;

    if (cat?.externalId) {
      map.set(cat.externalId, categoryDisplayName(cat));
    }
  }

  return map;
};

const assignCreatedCategoryIds = (trs: TestOpsPluginTestResult[], idByExternalId: Map<string, number>): void => {
  for (const tr of trs) {
    const cat = tr.category;

    if (!cat?.externalId) {
      continue;
    }

    const id = idByExternalId.get(cat.externalId);

    if (typeof id === "number") {
      tr.category = { ...cat, id };
    }
  }
};

export const syncLaunchCategories = async (
  client: TestOpsClient,
  trs: TestOpsPluginTestResult[],
  contextCategories: CategoryDefinition[],
): Promise<void> => {
  const categoryNamesByExternalId = collectCategoryNamesByExternalId(trs);

  if (categoryNamesByExternalId.size === 0) {
    return;
  }

  const bulkItems: { externalId: string; name: string; hide?: boolean; expand?: boolean }[] = [];
  const seenExternalIds = new Set<string>();

  for (const tr of trs) {
    const cat = tr.category;
    if (!cat?.externalId) continue;
    if (seenExternalIds.has(cat.externalId)) continue;
    seenExternalIds.add(cat.externalId);

    bulkItems.push({
      externalId: cat.externalId,
      name: categoryNamesByExternalId.get(cat.externalId) ?? categoryDisplayName(cat),
      hide: cat.hide,
      expand: cat.expand,
    });
  }

  const rankByExternalId = new Map<string, number>();
  for (const c of contextCategories) {
    // Prefer canonical ids, but allow ordering by name for categories originating from `tr.categories`
    if (!rankByExternalId.has(c.id)) {
      rankByExternalId.set(c.id, c.index);
    }
    if (!rankByExternalId.has(c.name)) {
      rankByExternalId.set(c.name, c.index);
    }
  }

  const ranked = bulkItems.map((item, i) => ({
    item,
    i,
    rank: rankByExternalId.get(item.externalId),
  }));

  ranked.sort((a, b) => {
    const ar = a.rank ?? Number.POSITIVE_INFINITY;
    const br = b.rank ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    return a.i - b.i; // stable for unknown ranks
  });

  const orderedBulkItems = ranked.map((r) => r.item);

  const launchId = client.launchId;

  try {
    const created = await client.createLaunchCategoriesBulk(launchId!, orderedBulkItems);
    const categoryIdByExternalId = new Map(created.map((r) => [r.externalId, r.id]));

    assignCreatedCategoryIds(trs, categoryIdByExternalId);
  } catch {
    // ignore
  }
};
