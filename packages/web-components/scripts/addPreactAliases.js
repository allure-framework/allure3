import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const addPreactAliases = async () => {
  // Determine the tsconfig.json location (assumed to be in the project root)
  const tsconfigPath = path.resolve("tsconfig.json");

  const content = await readFile(tsconfigPath, "utf8");
  const tsconfig = JSON.parse(content);

  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

  const preactCompatFile = require.resolve("preact/compat");
  const preactJsxRuntimeFile = require.resolve("preact/jsx-runtime");


  const preactCompatDir = path.relative(process.cwd(), path.join(path.dirname(preactCompatFile), ".."));
  const preactJsxRuntimeDir = path.relative(process.cwd(), path.join(path.dirname(preactJsxRuntimeFile), ".."));

  // Update the tsconfig paths with trailing separator so TypeScript treats them as directories
  tsconfig.compilerOptions.paths.react = [ preactCompatDir + path.sep ];
  tsconfig.compilerOptions.paths["react/jsx-runtime"] = [ preactJsxRuntimeDir + path.sep ];
  tsconfig.compilerOptions.paths["react-dom"] = [ preactCompatDir + path.sep ];
  tsconfig.compilerOptions.paths["react-dom/*"] = [ `${preactCompatDir + path.sep  }*` ];

  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
};

await addPreactAliases();
