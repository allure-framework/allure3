/**
 * Shared loader and converter for demo *-result.json (Allure 2 format) to TestResult DTO.
 * Used by E2E tests and by scripts/import_from_directory.ts.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';

const MAX_STRING = 100_000;

function cleanString(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return '';
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, MAX_STRING);
}

function deepSanitize<T>(obj: T): T {
  if (obj == null) return obj;
  if (typeof obj === 'string') return cleanString(obj) as T;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(deepSanitize) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[cleanString(String(k))] = deepSanitize(v);
  }
  return out as T;
}

/**
 * Extracts error from Allure 2 format: statusDetails.message/trace or top-level message/trace.
 */
function extractError(obj: Record<string, unknown>): { message?: string; trace?: string; actual?: string; expected?: string } | undefined {
  const details = obj.statusDetails as Record<string, unknown> | undefined;
  const message = cleanString((details?.message as string) ?? (obj.message as string) ?? '');
  const trace = cleanString((details?.trace as string) ?? (obj.trace as string) ?? '');
  if (!message && !trace) return undefined;
  return { message: message || undefined, trace: trace || undefined };
}

/**
 * Maps step with statusDetails to step with error (Allure 2 → API format).
 */
function mapStep(step: Record<string, unknown>): Record<string, unknown> {
  const error = extractError(step);
  const steps = ((step.steps as Array<Record<string, unknown>>) || []).map(mapStep);
  const out = { ...deepSanitize(step), steps, type: 'step' };
  if (error) (out as Record<string, unknown>).error = error;
  return out;
}

/**
 * Converts a raw *-result.json object (Allure 2: uuid, etc.) to TestResult DTO for API.
 */
export function convertToDTO(result: Record<string, unknown>): TestResultDTO {
  const error = extractError(result);
  const dto = {
    id: (result.uuid ?? result.id) as string,
    name: cleanString((result.name as string) || ''),
    fullName: cleanString((result.fullName as string) || (result.name as string) || ''),
    status: (result.status ?? 'unknown') as TestResultDTO['status'],
    flaky: Boolean(result.flaky),
    muted: Boolean(result.muted),
    known: Boolean(result.known),
    hidden: Boolean(result.hidden),
    historyId: result.historyId ? cleanString(String(result.historyId)) : undefined,
    testCaseId: result.testCaseId ? cleanString(String(result.testCaseId)) : undefined,
    start: result.start as number | undefined,
    stop: result.stop as number | undefined,
    duration:
      (result.duration as number | undefined) ??
      (result.start != null && result.stop != null ? (result.stop as number) - (result.start as number) : undefined),
    error,
    labels: ((result.labels as Array<{ name?: string; value?: string }>) || []).map((l) => ({
      name: cleanString(l.name || ''),
      value: l.value ? cleanString(l.value) : undefined
    })),
    parameters: ((result.parameters as Array<{ name?: string; value?: unknown; mode?: string; hidden?: boolean }>) || []).map((p) => {
      const mode = (p.mode as string) || (p.hidden ? 'hidden' : 'visible');
      return {
        name: cleanString(p.name || ''),
        value: p.value !== undefined && p.value !== null ? cleanString(String(p.value)) : '',
        hidden: mode === 'hidden',
        excluded: mode === 'excluded',
        masked: mode === 'masked'
      };
    }),
    links: ((result.links as Array<{ name?: string; url?: string; type?: string }>) || []).map((l) => ({
      name: l.name ? cleanString(l.name) : undefined,
      url: cleanString(l.url || ''),
      type: l.type ? cleanString(l.type) : undefined
    })),
    steps: ((result.steps as Array<Record<string, unknown>>) || []).map(mapStep),
    attachments: ((result.attachments as Array<{ name?: string; source?: string; type?: string }>) || []).map((a) => ({
      name: cleanString(a.name || ''),
      source: cleanString(a.source || ''),
      type: cleanString((a.type as string) || '')
    })),
    sourceMetadata: { readerId: 'allure3', metadata: {} }
  };
  return deepSanitize(dto) as TestResultDTO;
}

function loadResultFiles(dir: string): TestResultDTO[] {
  const out: TestResultDTO[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...loadResultFiles(fullPath));
    } else if (entry.name.endsWith('-result.json')) {
      const content = readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      out.push(convertToDTO(parsed));
    }
  }
  return out;
}

/**
 * Loads all *-result.json from the given directory (recursive) and returns DTOs.
 * @param demoDir - path to allure-results directory
 * @returns array of TestResult DTOs for API upload
 */
export function loadDemoResults(demoDir: string): TestResultDTO[] {
  if (!existsSync(demoDir)) {
    return [];
  }
  return loadResultFiles(demoDir);
}
