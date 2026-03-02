import { TestResult } from '../../domain/entities/TestResult.js';
import { TestResultAggregator } from '../../domain/services/TestResultAggregator.js';
import type { WidgetData, WidgetResponse } from '../dto/responses/WidgetResponse.js';
import type { EnvironmentItem } from '@allurereport/core-api';
import type { ILaunchGlobalsRepository } from '../../domain/repositories/ILaunchGlobalsRepository.js';
import type { ILaunchVariablesRepository } from '../../domain/repositories/ILaunchVariablesRepository.js';
import type { IAttachmentRepository } from '../../domain/repositories/IAttachmentRepository.js';
import type { ITestResultRepository } from '../../domain/repositories/ITestResultRepository.js';
import { extname } from 'path';

export interface PluginGlobalsData {
  exitCode?: { original: number; actual?: number };
  errors: Array<{ message?: string; trace?: string; actual?: string; expected?: string }>;
  attachments: Array<{ id: string; name: string; originalFileName: string; ext: string }>;
}

export interface TreeFiltersData {
  tags: string[];
}

export interface TimlineTr {
  id: string;
  name: string;
  status: string;
  hidden?: boolean;
  environment?: string;
  start: number;
  duration: number;
  host: string;
  thread: string;
  historyId?: string;
}

export class WidgetService {
  private readonly aggregator: TestResultAggregator;

  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchGlobalsRepository?: ILaunchGlobalsRepository,
    private readonly launchVariablesRepository?: ILaunchVariablesRepository,
    private readonly attachmentRepository?: IAttachmentRepository
  ) {
    this.aggregator = new TestResultAggregator();
  }

  generateSummaryWidget(results: ReadonlyArray<TestResult>): WidgetData {
    const summary = this.aggregator.generateSummary(results);
    return {
      statistic: summary.statistic,
      duration: summary.duration,
      flakyCount: summary.flakyCount,
      retriesCount: summary.retriesCount
    };
  }

  generateStatusWidget(results: ReadonlyArray<TestResult>): WidgetData {
    const statistic = this.aggregator.calculateStatistic(results);
    return {
      total: statistic.total,
      passed: statistic.passed || 0,
      failed: statistic.failed || 0,
      broken: statistic.broken || 0,
      skipped: statistic.skipped || 0,
      unknown: statistic.unknown || 0
    };
  }

  generateDurationWidget(results: ReadonlyArray<TestResult>): WidgetData {
    const totalDuration = this.aggregator.calculateTotalDuration(results);
    const statistic = this.aggregator.calculateStatistic(results);
    
    const avgDuration = statistic.total > 0 ? totalDuration / statistic.total : 0;
    
    return {
      total: totalDuration,
      average: avgDuration,
      count: statistic.total
    };
  }

  generateFlakyWidget(results: ReadonlyArray<TestResult>): WidgetData {
    const flakyResults = results.filter((r) => r.isFlaky());
    const statistic = this.aggregator.calculateStatistic(flakyResults);
    
    return {
      count: flakyResults.length,
      statistic: statistic
    };
  }

  generateRetriesWidget(results: ReadonlyArray<TestResult>): WidgetData {
    const resultsWithRetries = results.filter((r) => r.hasRetries());
    const totalRetries = results.reduce((sum, r) => sum + r.getRetriesCount(), 0);
    
    return {
      count: resultsWithRetries.length,
      totalRetries: totalRetries
    };
  }

  generateAllWidgets(results: ReadonlyArray<TestResult>): Map<string, WidgetData> {
    const widgets = new Map<string, WidgetData>();
    
    widgets.set('summary', this.generateSummaryWidget(results));
    widgets.set('status', this.generateStatusWidget(results));
    widgets.set('duration', this.generateDurationWidget(results));
    widgets.set('flaky', this.generateFlakyWidget(results));
    widgets.set('retries', this.generateRetriesWidget(results));
    
    return widgets;
  }

  async generateGlobalsWidget(launchIds: string[]): Promise<PluginGlobalsData> {
    const empty: PluginGlobalsData = { errors: [], attachments: [] };

    if (!this.launchGlobalsRepository || !this.attachmentRepository || launchIds.length === 0) {
      return empty;
    }

    const [allGlobals, globalAttachments] = await Promise.all([
      Promise.all(launchIds.map((id) => this.launchGlobalsRepository!.findByLaunchId(id))),
      this.attachmentRepository.findGlobalByLaunchIds(launchIds)
    ]);

    const errors: PluginGlobalsData['errors'] = [];
    let exitCodeOriginal = 0;
    let exitCodeActual: number | null = null;

    for (const g of allGlobals) {
      if (g?.errors?.length) {
        errors.push(...g.errors);
      }
      if (g) {
        if (g.exitCodeOriginal !== 0) {
          exitCodeOriginal = Math.max(exitCodeOriginal, g.exitCodeOriginal);
        }
        if (g.exitCodeActual != null) {
          exitCodeActual = exitCodeActual != null ? Math.max(exitCodeActual, g.exitCodeActual) : g.exitCodeActual;
        }
      }
    }

    // If any child has errors but exitCode was 0, parent should show as failed
    if (errors.length > 0 && exitCodeOriginal === 0) {
      exitCodeOriginal = 1;
    }

    const attachments = globalAttachments.map((a) => ({
      id: a.uid,
      name: a.originalFileName ?? a.name ?? 'attachment',
      originalFileName: a.originalFileName ?? a.name ?? 'attachment',
      ext: a.originalFileName ? extname(a.originalFileName) : ''
    }));

    const result: PluginGlobalsData = { errors, attachments };
    if (allGlobals.some((g) => g != null)) {
      result.exitCode = {
        original: exitCodeOriginal,
        ...(exitCodeActual != null && { actual: exitCodeActual })
      };
    }

    return result;
  }

  async generateTreeFiltersWidget(launchIds: string[]): Promise<TreeFiltersData> {
    const tags = await this.testResultRepository.findDistinctTagValuesByLaunchIds(launchIds);
    return { tags };
  }

  async generateTimelineWidget(launchIds: string[]): Promise<TimlineTr[]> {
    if (launchIds.length === 0) return [];
    const results = await this.testResultRepository.findByLaunchIds(launchIds);
    const minDuration = 1;
    const items: TimlineTr[] = [];
    for (const r of results) {
      const timeRange = r.getTimeRange();
      const start = timeRange.getStart();
      const stop = timeRange.getStop();
      if (start == null || stop == null) continue;
      const duration = timeRange.getDuration() ?? stop - start;
      if (duration < minDuration) continue;
      const labels = r.getLabels();
      const host = labels.find((l) => l.getName() === 'host')?.getValue() ?? 'default';
      const thread = labels.find((l) => l.getName() === 'thread')?.getValue() ?? 'main';
      items.push({
        id: r.getId().getValue(),
        name: r.getName().getValue(),
        status: r.getStatus().getValue(),
        hidden: r.isHidden(),
        environment: r.getEnvironment() ?? undefined,
        start,
        duration,
        host,
        thread,
        historyId: r.getHistoryId()?.getValue()
      });
    }
    return items;
  }

  async generateAllureEnvironmentWidget(launchIds: string[]): Promise<EnvironmentItem[]> {
    if (!this.launchGlobalsRepository || launchIds.length === 0) {
      return [];
    }
    const launchId = launchIds[0]!;
    const globals = await this.launchGlobalsRepository.findByLaunchId(launchId);
    return globals?.allureEnvironment ?? [];
  }

  async generateVariablesWidget(
    launchId: string,
    _launchIds: string[],
    environment?: string
  ): Promise<Record<string, string>> {
    if (!this.launchVariablesRepository) {
      return {};
    }

    // environment must be a valid UUID (child launch ID); "default" and other semantic names use parent only
    const envIsChildLaunchId = environment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(environment);
    if (envIsChildLaunchId) {
      const [parentVars, childVars] = await Promise.all([
        this.launchVariablesRepository.findByLaunchId(launchId),
        this.launchVariablesRepository.findByLaunchId(environment!)
      ]);
      return { ...(parentVars ?? {}), ...(childVars ?? {}) };
    }

    const vars = await this.launchVariablesRepository.findByLaunchId(launchId);
    return vars ?? {};
  }
}
