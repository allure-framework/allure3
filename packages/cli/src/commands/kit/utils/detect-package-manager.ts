import { access, readFile } from "node:fs/promises";
import { dirname, parse as parsePath, resolve } from "node:path";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

interface LockfileMapping {
  filename: string;
  packageManager: PackageManager;
}

const LOCKFILE_MAPPINGS: LockfileMapping[] = [
  { filename: "bun.lockb", packageManager: "bun" },
  { filename: "bun.lock", packageManager: "bun" },
  { filename: "yarn.lock", packageManager: "yarn" },
  { filename: "pnpm-lock.yaml", packageManager: "pnpm" },
  { filename: "package-lock.json", packageManager: "npm" },
];

const PACKAGE_MANAGER_PREFIXES: { prefix: string; packageManager: PackageManager }[] = [
  { prefix: "yarn", packageManager: "yarn" },
  { prefix: "pnpm", packageManager: "pnpm" },
  { prefix: "bun", packageManager: "bun" },
  { prefix: "npm", packageManager: "npm" },
];

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readPackageManagerField = async (dir: string): Promise<PackageManager | null> => {
  try {
    const content = await readFile(resolve(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(content) as { packageManager?: string };

    if (typeof parsed.packageManager === "string") {
      for (const { prefix, packageManager } of PACKAGE_MANAGER_PREFIXES) {
        if (parsed.packageManager.startsWith(prefix)) {
          return packageManager;
        }
      }
    }
  } catch {
    // no package.json or invalid JSON
  }

  return null;
};

const findLockfileInDir = async (dir: string): Promise<PackageManager | null> => {
  for (const { filename, packageManager } of LOCKFILE_MAPPINGS) {
    if (await fileExists(resolve(dir, filename))) {
      return packageManager;
    }
  }

  return null;
};

const isRootDir = (dir: string): boolean => {
  const parsed = parsePath(dir);

  return parsed.dir === dir || parsed.root === dir;
};

export const detectPackageManager = async (cwd: string): Promise<PackageManager> => {
  let currentDir = resolve(cwd);

  while (!isRootDir(currentDir)) {
    const fromField = await readPackageManagerField(currentDir);

    if (fromField) {
      return fromField;
    }

    const fromLockfile = await findLockfileInDir(currentDir);

    if (fromLockfile) {
      return fromLockfile;
    }

    currentDir = dirname(currentDir);
  }

  return "npm";
};

export const getInstallCommand = (
  packageManager: PackageManager,
  packages: string[],
  isDev: boolean = true,
): string => {
  const packageList = packages.join(" ");

  const devFlag = isDev ? { bun: " -d", yarn: " -D", pnpm: " -D", npm: " --save-dev" }[packageManager] : "";

  switch (packageManager) {
    case "bun":
      return `bun add${devFlag} ${packageList}`;
    case "yarn":
      return `yarn add${devFlag} ${packageList}`;
    case "pnpm":
      return `pnpm add${devFlag} ${packageList}`;
    case "npm":
      return `npm install${devFlag} ${packageList}`;
  }
};

export const getRemoveCommand = (packageManager: PackageManager, packages: string[]): string => {
  const packageList = packages.join(" ");

  switch (packageManager) {
    case "bun":
      return `bun remove ${packageList}`;
    case "yarn":
      return `yarn remove ${packageList}`;
    case "pnpm":
      return `pnpm remove ${packageList}`;
    case "npm":
      return `npm uninstall ${packageList}`;
  }
};
