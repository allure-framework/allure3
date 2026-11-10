// Semantic async boundaries are named by the shared components. File names,
// shared chunks and nested dependencies come from the completed compilation.
export class ReportFeatureAssetsPlugin {
  /** @param {import("webpack").Compiler} compiler */
  apply(compiler) {
    const name = "ReportFeatureAssetsPlugin";
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      compilation.hooks.processAssets.tap({ name, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const featureGroups = [...compilation.namedChunkGroups].filter(
          ([key, group]) => !group.isInitial() && /^(?:chart-.+|attachment-.+|error-diff)$/.test(key),
        );
        if (featureGroups.length === 0) throw new Error("No report feature chunk groups found");
        const featureBoundaries = new Set(featureGroups.map(([, group]) => group));
        // Base assets stop at optional feature boundaries; each feature includes all descendants.
        const collectAssets = (groups, { stopAtFeatures = false } = {}) => {
          const files = new Set();
          const visitedGroups = new Set();
          const visit = (group) => {
            if (visitedGroups.has(group) || (stopAtFeatures && featureBoundaries.has(group))) return;
            visitedGroups.add(group);
            for (const chunk of group.chunks) {
              for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) files.add(file);
            }
            for (const child of group.getChildren()) visit(child);
          };
          for (const group of groups) visit(group);
          // Set iteration also visits related assets added during the traversal.
          for (const file of files) {
            const asset = compilation.getAsset(file);
            if (!asset) throw new Error(`Missing report feature asset: ${file}`);
            for (const dependency of Object.values(asset.info.related ?? {}).flat()) {
              files.add(dependency);
            }
          }
          return files;
        };
        const base = collectAssets(compilation.entrypoints.values(), { stopAtFeatures: true });
        const features = Object.fromEntries(
          featureGroups
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, group]) => [key, [...collectAssets([group])].sort()]),
        );
        const classified = new Set([...base, ...Object.values(features).flat()]);
        // All report assets must be emitted by this REPORT tap. The archive reader
        // rejects unclassified files if another plugin emits assets later.
        // Keep unrelated assets (e.g. favicon) conservatively in the base set.
        for (const { name: file } of compilation.getAssets()) {
          if (file !== "manifest.json" && file !== "feature-assets.json" && !classified.has(file)) base.add(file);
        }
        compilation.emitAsset(
          "feature-assets.json",
          new sources.RawSource(
            JSON.stringify(
              {
                version: 1,
                initial: [
                  ...new Set([...compilation.entrypoints.values()].flatMap((group) => group.getFiles())),
                ].sort(),
                base: [...base].sort(),
                features,
              },
              null,
              2,
            ),
          ),
        );
      });
    });
  }
}
