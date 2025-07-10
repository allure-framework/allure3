import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeAnsiHtml, sanitizeAttachmentHtml } from "../src/sanitize.js";
import { sanitizer } from "./utils/dompurify.js";

describe("XSS Sanitization", () => {
  describe("sanitizeHtml", () => {
    it("should remove script tags", () => {
      const maliciousHtml = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
      const sanitized = sanitizeHtml(maliciousHtml, undefined, sanitizer);
      expect(sanitized).toContain('<p>Hello</p>');
      expect(sanitized).toContain('<p>World</p>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("XSS")');
    });

    it("should remove event handlers", () => {
      const maliciousHtml = '<img src="-" onerror="alert(\'XSS\')" alt="test">';
      const sanitized = sanitizeHtml(maliciousHtml, undefined, sanitizer);
      expect(sanitized).toContain('<img');
      expect(sanitized).toContain('alt="test"');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert(\'XSS\')');
    });

    it("should preserve safe HTML", () => {
      const safeHtml = '<p>Hello <strong>World</strong></p>';
      const sanitized = sanitizeHtml(safeHtml, undefined, sanitizer);
      expect(sanitized).toBe(safeHtml);
    });
  });

  describe("sanitizeAnsiHtml", () => {
    it("should remove all potentially dangerous content", () => {
      const maliciousHtml = '<script>alert("XSS")</script><span style="color: red;">Hello</span>';
      const sanitized = sanitizeAnsiHtml(maliciousHtml, sanitizer);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("XSS")');
      expect(sanitized).toContain('<span style="color: red;">Hello</span>');
    });

    it("should preserve ANSI color codes", () => {
      const ansiHtml = '<span style="color: #ff0000;">Red text</span>';
      const sanitized = sanitizeAnsiHtml(ansiHtml, sanitizer);
      expect(sanitized).toContain('<span style="color: #ff0000;">Red text</span>');
    });
  });

  describe("sanitizeAttachmentHtml", () => {
    it("should remove dangerous content from attachments", () => {
      const maliciousHtml = '<img src="-" onerror="alert(\'XSS\')" alt="test">';
      const sanitized = sanitizeAttachmentHtml(maliciousHtml, sanitizer);
      // Since img tags are forbidden in attachments, it should be removed
      expect(sanitized).not.toContain('<img');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert(\'XSS\')');
    });

    it("should preserve safe attachment content", () => {
      const safeHtml = '<div><p>Test content</p></div>';
      const sanitized = sanitizeAttachmentHtml(safeHtml, sanitizer);
      expect(sanitized).toBe(safeHtml);
    });
  });
}); 