import { readFileSync } from "node:fs";
import process from "node:process";

const parseVersion = (version: unknown) => {
  // Allure releases use major.minor.patch, optionally followed by a numbered prerelease (e.g. beta.2).
  const match =
    typeof version === "string" && /^(\d+)\.(\d+)\.(\d+)(?:-([a-z][a-z-]*)\.(\d+))?(?:\+[\w.-]+)?$/.exec(version);
  if (!match) return undefined;
  const numbers = [Number(match[1]), Number(match[2]), Number(match[3]), ...(match[5] ? [Number(match[5])] : [])];
  if (!numbers.every(Number.isSafeInteger)) return undefined;
  return { numbers: [...numbers.slice(0, 3), match[5] ? numbers[3]! : Infinity], distTag: match[4] ?? "latest" };
};

export const isNewerVersion = (candidate: unknown, current: unknown) => {
  const remote = parseVersion(candidate);
  const local = parseVersion(current);
  if (!remote || !local || (remote.distTag !== "latest" && remote.distTag !== local.distTag)) return false;
  const index = remote.numbers.findIndex((value, position) => value !== local.numbers[position]);
  return index !== -1 && remote.numbers[index]! > local.numbers[index]!;
};

export const parseUpdateNotifierArgs = (args: string[]) => {
  const separatorIndex = args.indexOf("--");
  const cliArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  return {
    args: [...cliArgs.filter((arg) => arg !== "--no-update-notifier"), ...args.slice(cliArgs.length)],
    disabled: cliArgs.includes("--no-update-notifier"),
  };
};

export const notifyAboutUpdate = async (args: string[], disabled = false) => {
  const env = process.env;
  const separatorIndex = args.indexOf("--");
  const cliArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  if (
    disabled ||
    !process.stderr.isTTY ||
    !cliArgs.length ||
    cliArgs[0] === "agent" ||
    cliArgs.some((arg) => ["--help", "-h", "--version", "-v"].includes(arg)) ||
    env.NO_UPDATE_NOTIFIER !== undefined ||
    env.NODE_ENV === "test" ||
    (env.CI !== undefined && env.CI !== "false" && env.CI !== "0") ||
    env.npm_config_user_agent !== undefined ||
    env.npm_execpath !== undefined
  )
    return;

  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      name: string;
      version: string;
    };
    const current = parseVersion(pkg.version);
    if (!current || typeof pkg.name !== "string") return;
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(current.distTag)}`,
      { signal: AbortSignal.timeout(1_000) },
    );
    if (!response.ok) return;
    const data = (await response.json()) as { version?: unknown };
    if (isNewerVersion(data?.version, pkg.version)) {
      process.stderr.write(
        `\nUpdate available ${pkg.version} → ${data.version}\nUpdate Allure using your package manager (${pkg.name}@${current.distTag}).\n\n`,
      );
    }
  } catch {
    // Update checks are best-effort: missing metadata and network errors must never affect the command.
  }
};
