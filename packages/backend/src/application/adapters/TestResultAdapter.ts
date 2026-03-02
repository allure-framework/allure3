import type { TestResult as TestResultDTO, TestStepResult, TestError as TestErrorDTO } from '@allurereport/core-api';
import { TestResult } from '../../domain/entities/TestResult.js';
import { TestResultId } from '../../domain/value-objects/TestResultId.js';
import { TestName } from '../../domain/value-objects/TestName.js';
import { Status } from '../../domain/value-objects/Status.js';
import { HistoryId } from '../../domain/value-objects/HistoryId.js';
import { TimeRange } from '../../domain/value-objects/TimeRange.js';
import { TestError } from '../../domain/value-objects/TestError.js';
import { StatusTransition } from '../../domain/value-objects/StatusTransition.js';
import { Label } from '../../domain/value-objects/Label.js';
import { Parameter } from '../../domain/value-objects/Parameter.js';
import { Link } from '../../domain/value-objects/Link.js';
import { Step } from '../../domain/entities/Step.js';
import { StepAdapter } from './StepAdapter.js';
import type { TestCase } from '../../domain/types/TestCase.js';
import type { SourceMetadata } from '../../domain/types/SourceMetadata.js';

export class TestResultAdapter {
  static toDomain(dto: TestResultDTO): TestResult {
    const id = new TestResultId(dto.id);
    const name = new TestName(dto.name, dto.fullName || null);
    const status = new Status(dto.status);
    const timeRange = new TimeRange(dto.start || null, dto.stop || null);
    const historyId = dto.historyId ? new HistoryId(dto.historyId) : null;
    const testCase: TestCase | null = dto.testCase
      ? {
          id: dto.testCase.id,
          allureId: dto.testCase.allureId || undefined,
          name: dto.testCase.name,
          fullName: dto.testCase.fullName || undefined
        }
      : (dto as { testCaseId?: string }).testCaseId
        ? {
            id: (dto as { testCaseId: string }).testCaseId,
            allureId: undefined,
            name: dto.name,
            fullName: dto.fullName || undefined
          }
        : null;

    const error = dto.error
      ? new TestError(dto.error.message || null, dto.error.trace || null, dto.error.actual || null, dto.error.expected || null)
      : null;

    const transition = dto.transition ? new StatusTransition(dto.transition) : null;

    const labels = (dto.labels ?? []).map((label) => new Label(label.name, label.value || null));
    const parameters = (dto.parameters ?? []).map(
      (param) => new Parameter(param.name, param.value, param.hidden, param.excluded, param.masked)
    );
    const links = (dto.links ?? []).map((link) => new Link(link.url, link.name || null, link.type || null));

    const steps = (dto.steps ?? []).map((stepDto) => StepAdapter.toDomain(stepDto));

    const retries = dto.retries ? dto.retries.map((retryDto) => TestResultAdapter.toDomain(retryDto)) : [];

    const sourceMetadata: SourceMetadata = dto.sourceMetadata
      ? { readerId: dto.sourceMetadata.readerId, metadata: dto.sourceMetadata.metadata ?? {} }
      : { readerId: 'unknown', metadata: {} };

    return new TestResult(
      id,
      name,
      status,
      timeRange,
      dto.fullName || null,
      historyId,
      testCase,
      dto.environment || null,
      dto.description || null,
      dto.descriptionHtml || null,
      dto.precondition || null,
      dto.preconditionHtml || null,
      dto.expectedResult || null,
      dto.expectedResultHtml || null,
      error,
      dto.flaky,
      dto.muted,
      dto.known,
      dto.hidden,
      transition,
      dto.hostId || null,
      dto.threadId || null,
      labels,
      parameters,
      links,
      steps,
      retries,
      sourceMetadata,
      dto.runSelector || null
    );
  }

  static toDTO(domain: TestResult): TestResultDTO {
    const timeRange = domain.getTimeRange();
    const error = domain.getError();

    const errorDto: TestErrorDTO | undefined = error
      ? {
          message: error.getMessage() || undefined,
          trace: error.getTrace() || undefined,
          actual: error.getActual() || undefined,
          expected: error.getExpected() || undefined
        }
      : undefined;

    return {
      id: domain.getId().getValue(),
      name: domain.getName().getValue(),
      status: domain.getStatus().getValue(),
      error: errorDto,
      testCase: domain.getTestCase()
        ? {
            id: domain.getTestCase()!.id,
            allureId: domain.getTestCase()!.allureId || undefined,
            name: domain.getTestCase()!.name,
            fullName: domain.getTestCase()!.fullName || undefined
          }
        : undefined,
      environment: domain.getEnvironment() || undefined,
      fullName: domain.getFullName() || undefined,
      historyId: domain.getHistoryId()?.getValue() || undefined,
      description: domain.getDescription() || undefined,
      descriptionHtml: domain.getDescriptionHtml() || undefined,
      precondition: domain.getPrecondition() || undefined,
      preconditionHtml: domain.getPreconditionHtml() || undefined,
      expectedResult: domain.getExpectedResult() || undefined,
      expectedResultHtml: domain.getExpectedResultHtml() || undefined,
      start: timeRange.getStart() || undefined,
      stop: timeRange.getStop() || undefined,
      duration: timeRange.getDuration() || undefined,
      flaky: domain.isFlaky(),
      muted: domain.isMuted(),
      known: domain.isKnown(),
      transition: domain.getTransition()?.getValue() || undefined,
      hidden: domain.isHidden(),
      hostId: domain.getHostId() || undefined,
      threadId: domain.getThreadId() || undefined,
      labels: domain.getLabels().map((label) => ({
        name: label.getName(),
        value: label.getValue() || undefined
      })),
      parameters: domain.getParameters().map((param) => ({
        name: param.getName(),
        value: param.getValue(),
        hidden: param.isHidden(),
        excluded: param.isExcluded(),
        masked: param.isMasked()
      })),
      links: domain.getLinks().map((link) => ({
        name: link.getName() || undefined,
        url: link.getUrl(),
        type: link.getType() || undefined
      })),
      steps: domain.getSteps().map((step) => StepAdapter.toDTO(step)),
      sourceMetadata: domain.getSourceMetadata(),
      runSelector: domain.getRunSelector() || undefined,
      retries: domain.getRetries().map((retry) => TestResultAdapter.toDTO(retry))
    };
  }
}
