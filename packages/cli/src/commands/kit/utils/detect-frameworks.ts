import { access, readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { type FrameworkDescriptor, FRAMEWORK_REGISTRY } from "./registry.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DetectedFramework {
  framework: FrameworkDescriptor;
  source: "dependencies" | "devDependencies" | "config-file" | "test-files";
  version: string;
}

export const readProjectPackageJson = async (cwd: string): Promise<PackageJson | null> => {
  try {
    const packageJsonPath = resolve(cwd, "package.json");
    const content = await readFile(packageJsonPath, "utf-8");

    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
};

const matchesGlob = (filename: string, pattern: string): boolean => {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        regexStr += "(?:.+/)?";
        i += 3;
      } else {
        regexStr += ".*";
        i += 2;
      }
    } else if (pattern[i] === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (".+^${}()|[]\\".includes(pattern[i])) {
      regexStr += `\\${pattern[i]}`;
      i++;
    } else {
      regexStr += pattern[i];
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`).test(filename);
};

const scanDirectoryShallow = async (dir: string, maxDepth: number, currentDepth = 0): Promise<string[]> => {
  if (currentDepth > maxDepth) {
    return [];
  }

  const results: string[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === "build") {
        continue;
      }

      const fullPath = join(dir, entry);

      try {
        const entryStat = await stat(fullPath);

        if (entryStat.isFile()) {
          results.push(entry);
        } else if (entryStat.isDirectory() && currentDepth < maxDepth) {
          const subEntries = await scanDirectoryShallow(fullPath, maxDepth, currentDepth + 1);

          for (const subEntry of subEntries) {
            results.push(join(entry, subEntry));
          }
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // skip inaccessible directories
  }

  return results;
};

export const detectFrameworksByFiles = async (cwd: string): Promise<DetectedFramework[]> => {
  const detected: DetectedFramework[] = [];
  const detectedIds = new Set<string>();

  for (const framework of FRAMEWORK_REGISTRY) {
    if (detectedIds.has(framework.id)) {
      continue;
    }

    for (const pattern of framework.configFilePatterns) {
      if (await fileExists(resolve(cwd, pattern))) {
        detected.push({ framework, source: "config-file", version: "unknown" });
        detectedIds.add(framework.id);
        break;
      }
    }
  }

  if (detectedIds.size < FRAMEWORK_REGISTRY.length) {
    const projectFiles = (await scanDirectoryShallow(cwd, 3)).map((filePath) => filePath.split(sep).join("/"));

    for (const framework of FRAMEWORK_REGISTRY) {
      if (detectedIds.has(framework.id)) {
        continue;
      }

      // WDIO commonly uses Cucumber feature files, but it's not the same as standalone Cucumber.js.
      // If WDIO was detected by config, avoid auto-detecting standalone Cucumber.js just by "*.feature".
      if (detectedIds.has("wdio") && framework.id === "cucumberjs") {
        continue;
      }

      const hasTestFiles = framework.testFilePatterns.some((pattern) =>
        projectFiles.some((file) => matchesGlob(file, pattern)),
      );

      if (hasTestFiles) {
        detected.push({ framework, source: "test-files", version: "unknown" });
        detectedIds.add(framework.id);
      }
    }
  }

  return detected;
};

export const detectFrameworks = async (cwd: string): Promise<DetectedFramework[]> => {
  const packageJson = await readProjectPackageJson(cwd);
  const detectedFromDeps: DetectedFramework[] = [];

  if (packageJson) {
    const allDependencies = {
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
    };

    for (const framework of FRAMEWORK_REGISTRY) {
      for (const [source, deps] of Object.entries(allDependencies)) {
        const detectPackageNames = framework.detectPackageNames ?? [framework.packageName];
        const matchedPackageName = detectPackageNames.find((name) => deps[name]);

        if (matchedPackageName) {
          detectedFromDeps.push({
            framework,
            source: source as "dependencies" | "devDependencies",
            version: deps[matchedPackageName],
          });
          break;
        }
      }
    }
  }

  const depIds = new Set(detectedFromDeps.map((d) => d.framework.id));
  const detectedFromFiles = await detectFrameworksByFiles(cwd);
  const fileOnlyDetections = detectedFromFiles.filter((d) => !depIds.has(d.framework.id));

  return [...detectedFromDeps, ...fileOnlyDetections];
};

export const detectInstalledAllurePackages = async (
  cwd: string,
): Promise<{ name: string; version: string; isDev: boolean }[]> => {
  const packageJson = await readProjectPackageJson(cwd);

  if (!packageJson) {
    return [];
  }

  const allurePackages: { name: string; version: string; isDev: boolean }[] = [];

  const scanDeps = (deps: Record<string, string>, isDev: boolean) => {
    for (const [name, version] of Object.entries(deps)) {
      if (
        name === "allure" ||
        name.startsWith("allure-") ||
        name.startsWith("@allurereport/") ||
        name === "newman-reporter-allure" ||
        name === "@wdio/allure-reporter"
      ) {
        allurePackages.push({ name, version, isDev });
      }
    }
  };

  scanDeps(packageJson.dependencies ?? {}, false);
  scanDeps(packageJson.devDependencies ?? {}, true);

  return allurePackages;
};
