import { glob } from "glob";

export const searchFilesByGlobs = async (basePath: string, patterns: readonly string[]) => {
  const files: string[] = [];

  for (const pattern of patterns) {
    const searchResults = await glob(pattern, {
      nodir: true,
      dot: true,
      absolute: true,
      windowsPathsNoEscape: true,
      cwd: basePath,
    });

    files.push(...searchResults);
  }

  return files;
};

export const searchDirectoriesByGlobs = async (basePath: string, patterns: readonly string[]) => {
  const directories: string[] = [];

  for (const pattern of patterns) {
    const searchResults = await glob(pattern, {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: basePath,
    });
    const matchedDirs = searchResults.filter((p) => /(\/|\\)$/.test(p));

    directories.push(...matchedDirs);
  }

  return directories;
};

export const searchAllureResultDirectories = async (basePath: string, patterns: readonly string[]) => {
  const resolvedPatterns = patterns.length ? patterns : ["./**/allure-results"];
  const resultDirectories = await searchDirectoriesByGlobs(basePath, resolvedPatterns);
  return { patterns: resolvedPatterns, resultDirectories };
};
