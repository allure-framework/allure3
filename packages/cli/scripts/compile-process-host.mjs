import { execFile } from "node:child_process";
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

const compileWithBuiltInCsc = (source, target, silent) => {
  const winDir = process.env.SystemRoot || process.env.WINDIR;
  if (!winDir) {
    throw new Error("Windows directory not found");
  }

  const cscPath = join(winDir, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe");
  if (!existsSync(cscPath)) {
    throw new Error(`C# compiler not found at ${cscPath}`);
  }

  execFile(cscPath, ["/utf8output", "/t:exe", "/o", "/out:" + target, source], (error, stdout) => {
    if (error) {
      console.error(error.message);
      console.error(stdout);
      process.exitCode = 1;
    } else if (!silent) {
      console.log(stdout);
    }
  });
};

const compileWithDotnet = async (source, target, silent) => {
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
    const stdout = await new Promise((resolve, reject) => {
      execFile(
        "dotnet",
        ["build", "--no-logo", "--interactive", "false", csprojPath],
        { cwd: tempDir },
        (error, stdout, stderr) => {
          if (error) {
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          } else {
            resolve(stdout);
          }
        },
      );
    });

    if (!silent) {
      console.log(stdout);
    }

    await copyFile(join(tempDir, "bin", "Release", "net4.5", basename(target)), target);
  } catch (error) {
    process.exitCode = 1;
    console.error(error.message);
    if (error.stderr) {
      console.error("Standard error:");
      console.error(error.stderr);
    }
    if (error.stdout) {
      console.error("Standard output:");
      console.error(error.stdout);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const compile = async (source, target, useDotnet, silent) => {
  if (useDotnet) {
    await compileWithDotnet(source, target, silent);
  } else if (process.platform === "win32") {
    compileWithBuiltInCsc(source, target, silent);
  }
};

const main = async (projectRoot, source, target, useDotnet, silent) => {
  if (force || !existsSync(target) || lstatSync(source).mtimeMs > lstatSync(target).mtimeMs) {
    await compile(source, target, useDotnet, silent);
  } else if (!silent) {
    console.log(`${relative(projectRoot, target)} is up-to-date.`);
  }
};

await main(projectRoot, sourcePath, targetPath, useDotnet, silent);
