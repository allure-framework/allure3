import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { feature, story } from "allure-js-commons";
import ts from "typescript";
import { expect, it } from "vite-plus/test";

// Validate the Rollup artifact consumed by Webpack, rather than only source imports.
// Requires the package build, like entrypoints.test.ts.
it("keeps optional viewer and chart modules outside the static entry graph", { timeout: 30_000 }, async () => {
  await feature("web-components-package");
  await story("lazy-entrypoints");
  const visited = new Set<string>();
  const deferred = new Set<string>();
  const visit = async (file: string): Promise<void> => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
    const imports: string[] = [];
    const inspect = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const target = node.moduleSpecifier.text;
        if (target.startsWith(".")) imports.push(resolve(dirname(file), target));
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        deferred.add(resolve(dirname(file), node.arguments[0].text));
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    for (const dependency of imports) await visit(dependency);
  };
  for (const entry of ["core", "Attachment", "ChartWidget"]) await visit(resolve(`dist/${entry}.js`));
  expect(deferred.size).toBeGreaterThanOrEqual(12); // Seven viewers and five chart families.
  for (const target of deferred) {
    expect(visited.has(target), `${target} must not also be reachable through eager imports`).toBe(false);
    await expect(access(target)).resolves.toBeUndefined();
  }
});
