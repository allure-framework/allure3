import { attachment, label, step } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import {
  ansiSemanticColors,
  ansiToHTML,
  isAnsi,
  normalizeAnsiForegroundColors,
  normalizeEscapedAnsiSequences,
} from "../src/strings.js";

const renderAnsiHtml = async (name: string, ansiText: string) =>
  step(name, async () => {
    const html = ansiToHTML(normalizeAnsiForegroundColors(ansiText), {
      fg: "var(--color-text-primary)",
      bg: "none",
      colors: ansiSemanticColors,
    });

    await attachment("rendered-html.html", html, "text/html");

    return html;
  });

describe("strings", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("detects ANSI escape sequences", () => {
    expect(isAnsi("\u001B[31mError\u001B[39m")).toBe(true);
    expect(isAnsi("plain output")).toBe(false);
  });

  test("normalizes escaped ANSI sequences", () => {
    expect(normalizeEscapedAnsiSequences("\\u001b[31mError\\x1b[39m")).toBe("\u001B[31mError\u001B[39m");
  });

  test("renders standard ANSI colors with theme semantic variables", async () => {
    const html = await renderAnsiHtml(
      "render standard ANSI foreground colors",
      "\u001B[31mError\u001B[39m \u001B[32mOK\u001B[39m",
    );

    expect({
      usesDangerToken: html.includes("color:var(--color-intent-danger-text)"),
      usesSuccessToken: html.includes("color:var(--color-intent-success-text)"),
      usesDefaultRed: html.includes("#A00"),
      usesDefaultGreen: html.includes("#0A0"),
    }).toEqual({
      usesDangerToken: true,
      usesSuccessToken: true,
      usesDefaultRed: false,
      usesDefaultGreen: false,
    });
  });

  test("normalizes extended foreground colors to readable theme semantic colors", async () => {
    const html = await renderAnsiHtml(
      "render extended ANSI foreground colors",
      "\u001B[38;2;255;0;0mError\u001B[39m \u001B[38;5;46mOK\u001B[39m",
    );

    expect({
      usesDangerToken: html.includes("color:var(--color-intent-danger-text)"),
      usesSuccessToken: html.includes("color:var(--color-intent-success-text)"),
      usesInlineRgbRed: html.includes("rgb(255,0,0)"),
      usesRawXtermGreen: html.includes("#00ff00"),
    }).toEqual({
      usesDangerToken: true,
      usesSuccessToken: true,
      usesInlineRgbRed: false,
      usesRawXtermGreen: false,
    });
  });

  test("drops ANSI background colors while preserving foreground colors", async () => {
    expect(normalizeAnsiForegroundColors("\u001B[31;48;2;255;0;0mRGB background\u001B[39;49m")).toBe(
      "\u001B[31mRGB background\u001B[39m",
    );
    expect(normalizeAnsiForegroundColors("\u001B[31;48;5;1mXterm background\u001B[39;49m")).toBe(
      "\u001B[31mXterm background\u001B[39m",
    );
    expect(normalizeAnsiForegroundColors("\u001B[48;5;1mBackground only\u001B[49m")).toBe("Background only");
    expect(normalizeAnsiForegroundColors("\u001B[48;2;1;2;3mBackground only\u001B[49m")).toBe("Background only");
    expect(normalizeAnsiForegroundColors("\u001B[48;5;999mInvalid background\u001B[49m")).toBe(
      "\u001B[48;5;999mInvalid background",
    );

    const html = await renderAnsiHtml(
      "render ANSI foreground colors without background fills",
      "\u001B[30;42mPassed\u001B[39;49m \u001B[31;48;5;2mFailed\u001B[39;49m \u001B[31;48;2;255;0;0mErrored\u001B[39;49m",
    );

    expect({
      keepsForeground: html.includes("color:var(--color-intent-danger-text)"),
      keepsTextAfterRgbBackground: html.includes("Errored"),
      hasBackgroundColor: html.includes("background-color"),
      hasXtermBackground: html.includes("#00ff00"),
      hasRgbBackground: html.includes("rgb(255,0,0)"),
    }).toEqual({
      keepsForeground: true,
      keepsTextAfterRgbBackground: true,
      hasBackgroundColor: false,
      hasXtermBackground: false,
      hasRgbBackground: false,
    });
  });
});
