import type { PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import AwesomePlugin from "../src/index.js";
import { fixtures, createFilesCollectorWithCheck } from "./fixtures.js";
import { join as joinPosix } from "node:path/posix";

// Path joining mechanism tests

describe("Path joining mechanism", () => {
  it("should use posix path joining for all file paths", async () => {
    const { files, context } = createFilesCollectorWithCheck((normalizedPath) => {
      // Check that the path uses forward slashes
      expect(normalizedPath).not.toContain('\\');
      // Check that the path does not contain duplicate slashes
      expect(normalizedPath).not.toMatch(/\/{2,}/);
      // Check that the path does not contain backslashes
      expect(normalizedPath).not.toMatch(/\\/);
      // Check that the path does not contain mixed slashes
      expect(normalizedPath).toMatch(/^[^\\]*$/);
      // Check that the path is created using path.posix.join
      const pathParts = normalizedPath.split('/');
      if (pathParts.length > 1) {
        const winPath = joinPosix(...pathParts);
        expect(normalizedPath).toBe(winPath);
      }
    });
    const plugin = new AwesomePlugin();
    await plugin.start(context as PluginContext);
    await plugin.update(context as PluginContext, fixtures.store);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should handle nested paths with posix separators", async () => {
    const { files, context } = createFilesCollectorWithCheck((normalizedPath) => {
      // Check that all path parts use forward slashes
      const pathParts = normalizedPath.split('/');
      expect(pathParts.every(part => !part.includes('\\'))).toBe(true);
      // Check that there are no duplicate directories
      const uniqueParts = new Set(pathParts);
      expect(uniqueParts.size).toBe(pathParts.length);
      // Check that the path is created using path.posix.join
      if (pathParts.length > 1) {
        const winPath = joinPosix(...pathParts);
        expect(normalizedPath).toBe(winPath);
      }
    });
    const plugin = new AwesomePlugin();
    await plugin.start(context as PluginContext);
    await plugin.update(context as PluginContext, fixtures.store);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should maintain consistent path structure across platforms", async () => {
    const { files, context } = createFilesCollectorWithCheck((normalizedPath) => {
      // Check that the path uses forward slashes regardless of platform
      expect(normalizedPath).not.toContain('\\');
      // Check that the path does not contain duplicate slashes
      expect(normalizedPath).not.toMatch(/\/{2,}/);
      // Check that the path does not contain mixed slashes
      expect(normalizedPath).toMatch(/^[^\\]*$/);
      // Check that the path is created using path.posix.join
      const pathParts = normalizedPath.split('/');
      if (pathParts.length > 1) {
        const winPath = joinPosix(...pathParts);
        expect(normalizedPath).toBe(winPath);
      }
    });
    const plugin = new AwesomePlugin();
    await plugin.start(context as PluginContext);
    await plugin.update(context as PluginContext, fixtures.store);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should handle singlefile mode correctly on Windows", async () => {
    // Save original platform
    const originalPlatform = process.platform;
    try {
      // Emulate Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      let indexHtmlContent: Buffer | undefined;
      const { files, context } = createFilesCollectorWithCheck((normalizedPath, content) => {
        // Check that path uses forward slashes even in singlefile mode
        expect(normalizedPath, `Path "${normalizedPath}" should use forward slashes`).not.toContain('\\');
        // Check that path doesn't contain duplicate slashes
        expect(normalizedPath, `Path "${normalizedPath}" should not contain duplicate slashes`).not.toMatch(/\/{2,}/);
        // Check that path is created using path.posix.join
        const pathParts = normalizedPath.split('/');
        if (pathParts.length > 1) {
          const expectedPath = joinPosix(...pathParts);
          expect(normalizedPath, `Path "${normalizedPath}" should be created using path.posix.join`).toBe(expectedPath);
        }
        // Save index.html content for later verification
        if (normalizedPath === 'index.html') {
          indexHtmlContent = content;
        }
      });
      const plugin = new AwesomePlugin({ singleFile: true });
      await plugin.start(context as PluginContext);
      await plugin.update(context as PluginContext, fixtures.store);
      expect(files.length, 'At least one file should be generated').toBeGreaterThan(0);
      // In singlefile mode, all files should be embedded in index.html
      expect(files).toContain('index.html');
      // Check that index.html contains all necessary data
      expect(indexHtmlContent, 'index.html content should be defined').toBeDefined();
      expect(indexHtmlContent!.toString(), 'index.html should contain data').toContain('<!DOCTYPE html>');
    } finally {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    }
  });

  it("should use posix path joining for attachments", async () => {
    const { files, context } = createFilesCollectorWithCheck((normalizedPath) => {
      // Check for attachments
      if (normalizedPath.includes('attachments')) {
        // Should only have forward slashes
        expect(normalizedPath).not.toContain('\\');
        // Should match joinPosix
        const pathParts = normalizedPath.split('/');
        if (pathParts.length > 1) {
          const posixPath = joinPosix(...pathParts);
          expect(normalizedPath).toBe(posixPath);
        }
      }
    });
    const plugin = new AwesomePlugin();
    await plugin.start(context as PluginContext);
    await plugin.update(context as PluginContext, fixtures.store);
    // Check that there is at least one attachment file
    expect(files.some(f => f.includes('attachments'))).toBe(true);
  });
}); 