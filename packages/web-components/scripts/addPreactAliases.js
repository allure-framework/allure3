import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Helper to convert a path to POSIX style (using forward slashes)
const toPosixPath = p => p.split(path.sep).join("/");

// Helper to ensure a path ends with a trailing slash
const ensureTrailingSlash = p => p.endsWith("/") || p.endsWith("*") ? p : `${p}/`;

const addPreactAliases = async () => {
  // Resolve the project root tsconfig.json
  const tsconfigPath = path.resolve("tsconfig.json");
  const content = await readFile(tsconfigPath, "utf8");
  const tsconfig = JSON.parse(content);

  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

  // Get preact's package root by resolving its package.json
  const preactPkgJson = require.resolve("preact/package.json");
  const preactRoot = path.dirname(preactPkgJson);

  // Instead of pointing to a dist folder, point to the package directories:
  // preact/compat for "react" and "react-dom", and preact/jsx-runtime for "react/jsx-runtime"
  const preactCompatDir = path.join(preactRoot, "compat");
  const preactJsxRuntimeDir = path.join(preactRoot, "jsx-runtime");

  // Compute relative, POSIX-style paths from the project root
  const relativePreactCompat = toPosixPath(path.relative(process.cwd(), preactCompatDir));
  const relativePreactJsxRuntime = toPosixPath(path.relative(process.cwd(), preactJsxRuntimeDir));

  // Ensure each path has a trailing slash as required by tsconfig "paths"
  const posixPreactCompat = ensureTrailingSlash(relativePreactCompat);
  const posixPreactJsxRuntime = ensureTrailingSlash(relativePreactJsxRuntime);
  const posixReactDomWildcard = ensureTrailingSlash(toPosixPath(path.join(posixPreactCompat, "*")));

  // Update tsconfig paths:
  tsconfig.compilerOptions.paths.react = [posixPreactCompat];
  tsconfig.compilerOptions.paths["react/jsx-runtime"] = [posixPreactJsxRuntime];
  tsconfig.compilerOptions.paths["react-dom"] = [posixPreactCompat];
  tsconfig.compilerOptions.paths["react-dom/*"] = [posixReactDomWildcard];

  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
};

await addPreactAliases();
