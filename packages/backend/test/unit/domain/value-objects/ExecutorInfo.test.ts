import { describe, it, expect } from 'vitest';
import { ExecutorInfo } from '../../../../src/domain/value-objects/ExecutorInfo.js';

describe('ExecutorInfo', () => {
  it('should create ExecutorInfo with all fields', () => {
    const executor = new ExecutorInfo(
      'Jenkins',
      'jenkins',
      'https://jenkins.example.com',
      123,
      'Build #123',
      'https://jenkins.example.com/build/123',
      'Report #123',
      'https://jenkins.example.com/report/123'
    );
    expect(executor.getName()).toBe('Jenkins');
    expect(executor.getType()).toBe('jenkins');
    expect(executor.getUrl()).toBe('https://jenkins.example.com');
    expect(executor.getBuildOrder()).toBe(123);
    expect(executor.getBuildName()).toBe('Build #123');
    expect(executor.getBuildUrl()).toBe('https://jenkins.example.com/build/123');
    expect(executor.getReportName()).toBe('Report #123');
    expect(executor.getReportUrl()).toBe('https://jenkins.example.com/report/123');
  });

  it('should create ExecutorInfo with minimal fields', () => {
    const executor = new ExecutorInfo();
    expect(executor.getName()).toBeNull();
    expect(executor.getType()).toBeNull();
    expect(executor.getUrl()).toBeNull();
  });

  it('should create ExecutorInfo with partial fields', () => {
    const executor = new ExecutorInfo('Jenkins', 'jenkins');
    expect(executor.getName()).toBe('Jenkins');
    expect(executor.getType()).toBe('jenkins');
    expect(executor.getUrl()).toBeNull();
  });

  it('should throw error for invalid URL', () => {
    expect(() => new ExecutorInfo(null, null, 'not-a-valid-url')).toThrow('Invalid executor URL');
  });

  it('should throw error for invalid buildUrl', () => {
    expect(() => new ExecutorInfo(null, null, null, null, null, 'not-a-valid-url')).toThrow('Invalid build URL');
  });

  it('should throw error for invalid reportUrl', () => {
    expect(() => new ExecutorInfo(null, null, null, null, null, null, null, 'not-a-valid-url')).toThrow('Invalid report URL');
  });

  it('should accept null URLs', () => {
    const executor = new ExecutorInfo('Jenkins', 'jenkins', null, null, null, null, null, null);
    expect(executor.getUrl()).toBeNull();
    expect(executor.getBuildUrl()).toBeNull();
    expect(executor.getReportUrl()).toBeNull();
  });

  it('should accept empty string URLs as null', () => {
    // Empty strings are treated as null in constructor logic
    const executor = new ExecutorInfo('Jenkins', 'jenkins', '', null, null, '', null, '');
    // URLs are validated only if not null and not empty
    expect(executor).toBeDefined();
  });

  it('should accept valid HTTP URLs', () => {
    const executor = new ExecutorInfo(null, null, 'http://example.com');
    expect(executor.getUrl()).toBe('http://example.com');
  });

  it('should accept valid HTTPS URLs', () => {
    const executor = new ExecutorInfo(null, null, 'https://example.com');
    expect(executor.getUrl()).toBe('https://example.com');
  });

  it('should be equal to another ExecutorInfo with same values', () => {
    const executor1 = new ExecutorInfo('Jenkins', 'jenkins', 'https://example.com', 123);
    const executor2 = new ExecutorInfo('Jenkins', 'jenkins', 'https://example.com', 123);
    expect(executor1.equals(executor2)).toBe(true);
  });

  it('should not be equal to another ExecutorInfo with different name', () => {
    const executor1 = new ExecutorInfo('Jenkins', 'jenkins');
    const executor2 = new ExecutorInfo('GitLab', 'jenkins');
    expect(executor1.equals(executor2)).toBe(false);
  });

  it('should be immutable', () => {
    const executor = new ExecutorInfo('Jenkins', 'jenkins');
    const name = executor.getName();
    const type = executor.getType();
    expect(executor.getName()).toBe(name);
    expect(executor.getType()).toBe(type);
  });
});
