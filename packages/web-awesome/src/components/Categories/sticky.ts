type StickyOverrides = Partial<Record<`--${string}`, string>>;

export const createCategoriesStickyStyle = (depth: number, overrides: StickyOverrides = {}) =>
  ({
    "--categories-sticky-depth": `${depth}`,
    "--tree-section-position": "sticky",
    "--tree-section-top": `calc(${depth} * var(--categories-sticky-step))`,
    "--tree-section-z": `${100 - depth}`,
    "--tree-section-bg": "var(--bg-base-primary)",
    "--tree-section-min-height": "var(--categories-sticky-step)",
    ...overrides,
  }) as Record<string, string>;
