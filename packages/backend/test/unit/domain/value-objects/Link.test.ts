import { describe, it, expect } from 'vitest';
import { Link } from '../../../../src/domain/value-objects/Link.js';

describe('Link', () => {
  it('should create Link with URL only', () => {
    const link = new Link('https://example.com');
    expect(link.getUrl()).toBe('https://example.com');
    expect(link.getName()).toBeNull();
    expect(link.getType()).toBeNull();
  });

  it('should create Link with URL and name', () => {
    const link = new Link('https://example.com', 'Example');
    expect(link.getUrl()).toBe('https://example.com');
    expect(link.getName()).toBe('Example');
    expect(link.getType()).toBeNull();
  });

  it('should create Link with URL, name and type', () => {
    const link = new Link('https://example.com', 'Example', 'issue');
    expect(link.getUrl()).toBe('https://example.com');
    expect(link.getName()).toBe('Example');
    expect(link.getType()).toBe('issue');
  });

  it('should throw error for empty URL', () => {
    expect(() => new Link('')).toThrow('Link URL cannot be empty');
  });

  it('should throw error for whitespace-only URL', () => {
    expect(() => new Link('   ')).toThrow('Link URL cannot be empty');
  });

  it('should throw error for null URL', () => {
    expect(() => new Link(null as any)).toThrow('Link URL cannot be empty');
  });

  it('should throw error for undefined URL', () => {
    expect(() => new Link(undefined as any)).toThrow('Link URL cannot be empty');
  });

  it('should throw error for invalid URL', () => {
    expect(() => new Link('not-a-valid-url')).toThrow('Invalid URL');
  });

  it('should accept valid HTTP URL', () => {
    const link = new Link('http://example.com');
    expect(link.getUrl()).toBe('http://example.com');
  });

  it('should accept valid HTTPS URL', () => {
    const link = new Link('https://example.com');
    expect(link.getUrl()).toBe('https://example.com');
  });

  it('should accept URL with path', () => {
    const link = new Link('https://example.com/path/to/resource');
    expect(link.getUrl()).toBe('https://example.com/path/to/resource');
  });

  it('should accept URL with query parameters', () => {
    const link = new Link('https://example.com?param=value');
    expect(link.getUrl()).toBe('https://example.com?param=value');
  });

  it('should be equal to another Link with same values', () => {
    const link1 = new Link('https://example.com', 'Example', 'issue');
    const link2 = new Link('https://example.com', 'Example', 'issue');
    expect(link1.equals(link2)).toBe(true);
  });

  it('should not be equal to another Link with different URL', () => {
    const link1 = new Link('https://example.com');
    const link2 = new Link('https://other.com');
    expect(link1.equals(link2)).toBe(false);
  });

  it('should not be equal to another Link with different name', () => {
    const link1 = new Link('https://example.com', 'Example 1');
    const link2 = new Link('https://example.com', 'Example 2');
    expect(link1.equals(link2)).toBe(false);
  });

  it('should not be equal to another Link with different type', () => {
    const link1 = new Link('https://example.com', 'Example', 'issue');
    const link2 = new Link('https://example.com', 'Example', 'tms');
    expect(link1.equals(link2)).toBe(false);
  });

  it('should be equal when both have null name and type', () => {
    const link1 = new Link('https://example.com', null, null);
    const link2 = new Link('https://example.com', null, null);
    expect(link1.equals(link2)).toBe(true);
  });

  it('should be immutable', () => {
    const link = new Link('https://example.com', 'Example');
    const url = link.getUrl();
    const name = link.getName();
    expect(link.getUrl()).toBe(url);
    expect(link.getName()).toBe(name);
  });
});
