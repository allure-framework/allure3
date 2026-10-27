import { execFile, spawn } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { copyFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

const srcDir = join(projectRoot, "src");
const distDir = join(projectRoot, "dist");

const sourcePath = join(srcDir, "utils/supervisor/windows/process-host.cs");
const targetPath = join(distDir, "utils/supervisor/windows/process-host.exe");

const useDotnet = process.argv.includes("--use-dotnet");
const silent = process.argv.includes("--silent");
const force = process.argv.includes("--force");

const compilerTimeoutMs = 120_000;
const diagnostic = (message) => console.error(`[process-host ${new Date().toISOString()}] ${message}`);

const runCompiler = (command, args, cwd = projectRoot) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    diagnostic(`Starting ${JSON.stringify([command, ...args])}; cwd=${cwd}; timeout=${compilerTimeoutMs}ms`);
    // Inherit output so compiler diagnostics are visible immediately, including with --silent.
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "inherit", "inherit"],
      detached: process.platform !== "win32",
    });
    let timedOut = false;
    const elapsed = () => `${Date.now() - started}ms`;
    child.once("spawn", () => diagnostic(`Compiler started; pid=${child.pid}`));
    const heartbeat = setInterval(
      () => diagnostic(`Compiler still running; pid=${child.pid}; elapsed=${elapsed()}`),
      15_000,
    );
    const timeout = setTimeout(() => {
      timedOut = true;
      clearInterval(heartbeat);
      diagnostic(`Compiler timed out; pid=${child.pid}; elapsed=${elapsed()}; terminating process tree`);
      if (process.platform === "win32") {
        execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { timeout: 5_000 }, (error, stdout, stderr) => {
          if (stdout) process.stderr.write(stdout);
          if (stderr) process.stderr.write(stderr);
          if (error) {
            diagnostic(`Process tree termination failed: ${error.message}`);
            child.kill("SIGKILL");
          }
          reject(new Error(`Compiler exceeded ${compilerTimeoutMs}ms timeout`));
        });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          diagnostic(`Process group termination failed: ${error.message}`);
          child.kill("SIGKILL");
        }
        reject(new Error(`Compiler exceeded ${compilerTimeoutMs}ms timeout`));
      }
    }, compilerTimeoutMs);
    const cleanup = () => {
      clearInterval(heartbeat);
      clearTimeout(timeout);
    };
    child.once("error", (error) => {
      cleanup();
      diagnostic(`Compiler process error after ${elapsed()}: ${error.message}`);
      reject(error);
    });
    child.once("close", (code, signal) => {
      cleanup();
      diagnostic(`Compiler closed; pid=${child.pid}; code=${code}; signal=${signal}; elapsed=${elapsed()}`);
      if (timedOut) {
        reject(new Error(`Compiler exceeded ${compilerTimeoutMs}ms timeout`));
      } else if (code !== 0) {
        reject(new Error(`Compiler failed with exit code ${code}, signal ${signal}`));
      } else {
        resolve();
      }
    });
  });

const compileWithBuiltInCsc = async (source, target) => {
  const winDir = process.env.SystemRoot || process.env.WINDIR;
  if (!winDir) {
    throw new Error("Windows directory not found");
  }

  const csc64Path = join(winDir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
  const csc32Path = join(winDir, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe");
  const cscPath = [csc64Path, csc32Path].find(existsSync);

  if (!cscPath) {
    throw new Error(`C# compiler not found at "${csc64Path}" or "${csc32Path}"`);
  }

  await runCompiler(cscPath, ["/nologo", "/utf8output", "/t:exe", "/o", "/out:" + target, source]);
};

const compileWithDotnet = async (source, target) => {
  const csprojContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net4.5</TargetFramework>
    <Configuration>Release</Configuration>
    <AssemblyName>${basename(target, ".exe")}</AssemblyName>
    <EnableDefaultItems>false</EnableDefaultItems>
    <CheckEolTargetFramework>false</CheckEolTargetFramework>
    <DebugType>none</DebugType>
    <GenerateSupportedRuntime>false</GenerateSupportedRuntime>
    <AutoGenerateBindingRedirects>false</AutoGenerateBindingRedirects>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="${source}" />
    <PackageReference
      Include="Microsoft.NETFramework.ReferenceAssemblies.net45"
      Version="1.0.3"
      PrivateAssets="All" />
    <Reference Include="System.Web.Extensions" />
  </ItemGroup>
</Project>
  `;

  const tempDir = await mkdtemp(join(tmpdir(), "allure-process-host-"));
  try {
    const csprojPath = join(tempDir, "process-host.csproj");
    await writeFile(csprojPath, csprojContent);
    await runCompiler("dotnet", ["build", "--nologo", "--interactive", "false", csprojPath], tempDir);

    diagnostic(`Copying compiled host to ${target}`);
    await copyFile(join(tempDir, "bin", "Release", "net4.5", basename(target)), target);
  } finally {
    diagnostic(`Removing temporary project ${tempDir}`);
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3 }).catch((error) => {
      diagnostic(`Temporary project cleanup failed: ${error.message}`);
    });
  }
};

const compile = async (source, target, useDotnet) => {
  if (useDotnet) {
    await compileWithDotnet(source, target);
  } else if (process.platform === "win32") {
    await compileWithBuiltInCsc(source, target);
  } else {
    diagnostic(`Skipping Windows process-host compilation on ${process.platform}`);
  }
};

const main = async (projectRoot, source, target, useDotnet, silent) => {
  if (force || !existsSync(target) || lstatSync(source).mtimeMs > lstatSync(target).mtimeMs) {
    await compile(source, target, useDotnet);
    diagnostic("Compilation step completed");
  } else if (!silent) {
    console.log(`${relative(projectRoot, target)} is up-to-date.`);
  }
};

try {
  await main(projectRoot, sourcePath, targetPath, useDotnet, silent);
} catch (error) {
  diagnostic(error.stack ?? error.message);
  process.exitCode = 1;
}
