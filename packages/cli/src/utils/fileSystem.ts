import { glob } from "glob";

export const findFilesByGlobs = async (basePath: string, patterns: readonly string[]) => {
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

export const findDirectoriesByGlobs = async (basePath: string, patterns: readonly string[]) => {
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

export const findAllureResultDirectories = async (basePath: string, patterns: readonly string[]) => {
  const resolvedPatterns = patterns.length ? patterns : ["./**/allure-results"];
  const resultDirectories = await findDirectoriesByGlobs(basePath, resolvedPatterns);
  return { patterns: resolvedPatterns, resultDirectories };
};
