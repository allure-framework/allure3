// Semantic async boundaries are named by the shared components. File names,
// shared chunks and nested dependencies come from the completed compilation.
export class ReportFeatureAssetsPlugin {
  apply(compiler) {
    const name = "ReportFeatureAssetsPlugin";
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      compilation.hooks.processAssets.tap({ name, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const roots = [...compilation.namedChunkGroups].filter(
          ([key, group]) => !group.isInitial() && /^(?:chart-.+|attachment-.+|error-diff)$/.test(key),
        );
        if (roots.length === 0) throw new Error("No report feature chunk groups found");
        const owned = new Set(roots.map(([, group]) => group));
        const closure = (groups, stopAtFeatures = false) => {
          const files = new Set();
          const visited = new Set();
          const visit = (group) => {
            if (visited.has(group) || (stopAtFeatures && owned.has(group))) return;
            visited.add(group);
            for (const chunk of group.chunks) {
              for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) files.add(file);
            }
            for (const child of group.getChildren()) visit(child);
          };
          for (const group of groups) visit(group);
          const related = (file) => {
            const asset = compilation.getAsset(file);
            if (!asset) throw new Error(`Missing report feature asset: ${file}`);
            for (const dependency of Object.values(asset.info.related ?? {}).flat()) {
              if (!files.has(dependency)) {
                files.add(dependency);
                related(dependency);
              }
            }
          };
          for (const file of files) related(file);
          return files;
        };
        const base = closure(compilation.entrypoints.values(), true);
        const features = Object.fromEntries(
          roots
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, group]) => [key, [...closure([group])].sort()]),
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
