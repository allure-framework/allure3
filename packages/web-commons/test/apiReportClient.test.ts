/**
 * Unit tests for apiReportClient (ALLURE3_AWESOME_CHECKLIST.md).
 * Tests for getApiReportUrl — some FAIL until mapping is added for timeline, globals, etc.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getApiReportUrl } from "../src/apiReportClient.js";

const API_BASE = "http://localhost:3000";
const API_PREFIX = "/api/v1";

describe("getApiReportUrl", () => {
  beforeEach(() => {
    (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId?: string } }).allureReportOptions = {
      apiBaseUrl: API_BASE,
      launchId: "launch-123",
    };
  });

  afterEach(() => {
    (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = undefined;
  });

  describe("existing mappings", () => {
    test("returns URL for widgets/summary.json", () => {
      const url = getApiReportUrl("widgets/summary.json");
      expect(url).toBe(`${API_BASE}${API_PREFIX}/widgets/summary?launch_id=launch-123`);
    });

    test("returns URL for widgets/statistic.json", () => {
      const url = getApiReportUrl("widgets/statistic.json");
      expect(url).toBe(`${API_BASE}${API_PREFIX}/widgets/status?launch_id=launch-123`);
    });

    test("returns URL for data/test-results/:id.json", () => {
      const url = getApiReportUrl("data/test-results/abc-123.json");
      expect(url).toBe(`${API_BASE}${API_PREFIX}/test-results/abc-123`);
    });

    test("returns URL for data/test-env-groups/:id.json", () => {
      const url = getApiReportUrl("data/test-env-groups/tc-456.json");
      expect(url).toBe(`${API_BASE}${API_PREFIX}/test-env-groups/tc-456?launch_id=launch-123`);
    });

    test("returns URL for widgets/suites tree", () => {
      const url = getApiReportUrl("widgets/default/tree.json");
      expect(url).toContain("/trees/suites");
      expect(url).toContain("launch_id=launch-123");
    });
  });

  describe("TODO: mappings for Awesome API mode (ALLURE3_AWESOME_CHECKLIST)", () => {
    test("returns URL for widgets/timeline.json when implemented", () => {
      const url = getApiReportUrl("widgets/timeline.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/timeline`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for widgets/globals.json when implemented", () => {
      const url = getApiReportUrl("widgets/globals.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/globals`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for widgets/quality-gate.json when implemented", () => {
      const url = getApiReportUrl("widgets/quality-gate.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/quality-gate`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for widgets/allure_environment.json when implemented", () => {
      const url = getApiReportUrl("widgets/allure_environment.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/allure_environment`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for widgets/variables.json when implemented", () => {
      const url = getApiReportUrl("widgets/variables.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/variables`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for widgets/tree-filters.json when implemented", () => {
      const url = getApiReportUrl("widgets/tree-filters.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/tree-filters`);
      expect(url).toContain("launch_id=launch-123");
    });

    test("returns URL for per-env widgets/widgets/:env/variables.json when implemented", () => {
      const url = getApiReportUrl("widgets/default/variables.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/widgets/variables`);
      expect(url).toContain("launch_id=launch-123");
    });
  });

  describe("TODO: environments from API (ALLURE3_AWESOME_CHECKLIST)", () => {
    test("returns URL for widgets/environments.json mapping to GET /launches/:id/environments when implemented", () => {
      const url = getApiReportUrl("widgets/environments.json");
      expect(url).not.toBeNull();
      expect(url).toContain(`${API_PREFIX}/launches/launch-123/environments`);
    });
  });

  describe("data/test-env-groups requires launchId", () => {
    test("returns null when launchId is not set", () => {
      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string } }).allureReportOptions = {
        apiBaseUrl: API_BASE,
      };
      const url = getApiReportUrl("data/test-env-groups/tc-456.json");
      expect(url).toBeNull();
    });
  });

  describe("without apiBaseUrl", () => {
    test("returns null when apiBaseUrl is not set", () => {
      (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = {};
      const url = getApiReportUrl("widgets/summary.json");
      expect(url).toBeNull();
    });

    test("returns null when allureReportOptions is undefined", () => {
      (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = undefined;
      const url = getApiReportUrl("widgets/summary.json");
      expect(url).toBeNull();
    });
  });
});
