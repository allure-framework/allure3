import { realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { cwd as processCwd } from "node:process";

export type CleanOutputParams = {
  output: string;
  cwd: string;
  /** Directories with test results; the output must neither contain nor be located inside them */
  resultsDirs?: string[];
  /** Other files the report reads (dumps, history, known issues); the output must not contain them */
  inputs?: string[];
};

const isSameOrInside = (parent: string, child: string) => {
  const rel = relative(parent, child);

  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** Resolves symlinks of the longest existing part of the path, so the checks can't be fooled by links or casing */
const realResolve = async (path: string): Promise<string> => {
  const absolute = resolve(path);

  try {
    return await realpath(absolute);
  } catch {
    const parent = dirname(absolute);

    return parent === absolute ? absolute : join(await realResolve(parent), basename(absolute));
  }
};

/** Returns the reason why the output directory must not be removed, or undefined when it is safe to remove */
export const getUnsafeCleanReason = async (params: CleanOutputParams): Promise<string | undefined> => {
  const cwd = resolve(params.cwd);
  const output = await realResolve(resolve(cwd, params.output));

  if (output === parse(output).root) {
    return "it is a filesystem root";
  }

  const mustSurvive: [label: string, path: string][] = [
    ["the working directory", cwd],
    ["the process working directory", processCwd()],
    ["the home directory", homedir()],
    ...(params.resultsDirs ?? []).map((dir): [string, string] => ["a results directory", resolve(cwd, dir)]),
    ...(params.inputs ?? []).map((file): [string, string] => ["an input file", resolve(cwd, file)]),
  ];

  for (const [label, path] of mustSurvive) {
    if (isSameOrInside(output, await realResolve(path))) {
      return `it is or contains ${label} (${path})`;
    }
  }

  for (const dir of params.resultsDirs ?? []) {
    if (isSameOrInside(await realResolve(resolve(cwd, dir)), output)) {
      return `it is located inside a results directory (${resolve(cwd, dir)})`;
    }
  }

  return undefined;
};

/** Removes the report output directory. Throws when the path is considered dangerous; a missing directory is fine */
export const cleanOutputDirectory = async (params: CleanOutputParams) => {
  const output = resolve(params.cwd, params.output);
  const reason = await getUnsafeCleanReason(params);

  if (reason) {
    throw new Error(`Refusing to clean the output directory ${output}: ${reason}`);
  }

  await rm(output, { recursive: true, force: true });
};
