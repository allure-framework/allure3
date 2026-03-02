import { TestResult } from '../../../../domain/entities/TestResult.js';
import { TestResultId } from '../../../../domain/value-objects/TestResultId.js';
import { TestName } from '../../../../domain/value-objects/TestName.js';
import { Status } from '../../../../domain/value-objects/Status.js';
import { HistoryId } from '../../../../domain/value-objects/HistoryId.js';
import { TimeRange } from '../../../../domain/value-objects/TimeRange.js';
import { TestError } from '../../../../domain/value-objects/TestError.js';
import { StatusTransition } from '../../../../domain/value-objects/StatusTransition.js';
import { Label } from '../../../../domain/value-objects/Label.js';
import { Parameter } from '../../../../domain/value-objects/Parameter.js';
import { Link } from '../../../../domain/value-objects/Link.js';
import { Step } from '../../../../domain/entities/Step.js';
import { TestResultEntity } from '../../entities/TestResultEntity.js';
import { LabelEntity } from '../../entities/LabelEntity.js';
import { ParameterEntity } from '../../entities/ParameterEntity.js';
import { LinkEntity } from '../../entities/LinkEntity.js';
import { StepEntity } from '../../entities/StepEntity.js';
import { RetryEntity } from '../../entities/RetryEntity.js';
import { StepMapper } from './StepMapper.js';
import type { TestCase } from '../../../../domain/types/TestCase.js';
import { randomUUID } from 'crypto';

export interface RelatedData {
  labels?: LabelEntity[];
  parameters?: ParameterEntity[];
  links?: LinkEntity[];
  steps?: StepEntity[];
  retries?: RetryEntity[];
}

const truncate = (s: string | null | undefined, max: number): string | null =>
  s == null ? null : (s.length <= max ? s : s.slice(0, max));

export class TestResultMapper {
  static toEntity(domain: TestResult, launchId: string): TestResultEntity {
    const entity = new TestResultEntity();
    entity.id = domain.getId().getValue();
    entity.launchId = launchId;
    entity.historyId = truncate(domain.getHistoryId()?.getValue() ?? null, 255);
    entity.testCaseId = truncate(domain.getTestCase()?.id ?? null, 255);
    entity.name = truncate(domain.getName().getValue(), 1000) ?? '';
    entity.fullName = truncate(domain.getFullName(), 2000);
    entity.status = domain.getStatus().getValue();
    entity.environment = domain.getEnvironment();

    const timeRange = domain.getTimeRange();
    entity.startTime = timeRange.getStart();
    entity.stopTime = timeRange.getStop();
    entity.duration = timeRange.getDuration();

    entity.description = domain.getDescription();
    entity.descriptionHtml = domain.getDescriptionHtml();
    entity.precondition = domain.getPrecondition();
    entity.preconditionHtml = domain.getPreconditionHtml();
    entity.expectedResult = domain.getExpectedResult();
    entity.expectedResultHtml = domain.getExpectedResultHtml();

    entity.flaky = domain.isFlaky();
    entity.muted = domain.isMuted();
    entity.known = domain.isKnown();
    entity.hidden = domain.isHidden();
    entity.transition = domain.getTransition()?.getValue() || null;

    const error = domain.getError();
    entity.error = error
      ? {
          message: error.getMessage() || undefined,
          trace: error.getTrace() || undefined,
          actual: error.getActual() || undefined,
          expected: error.getExpected() || undefined
        }
      : null;

    entity.sourceMetadata = domain.getSourceMetadata();

    // Map related entities
    entity.labels = domain.getLabels().map((label) => {
      const labelEntity = new LabelEntity();
      labelEntity.id = randomUUID();
      labelEntity.testResultId = entity.id;
      labelEntity.name = truncate(label.getName(), 255) ?? '';
      labelEntity.value = truncate(label.getValue(), 1000);
      return labelEntity;
    });

    entity.parameters = domain.getParameters().map((param) => {
      const paramEntity = new ParameterEntity();
      paramEntity.id = randomUUID();
      paramEntity.testResultId = entity.id;
      paramEntity.name = truncate(param.getName(), 255) ?? '';
      paramEntity.value = param.getValue();
      paramEntity.hidden = param.isHidden();
      paramEntity.excluded = param.isExcluded();
      paramEntity.masked = param.isMasked();
      return paramEntity;
    });

    entity.links = domain.getLinks().map((link) => {
      const linkEntity = new LinkEntity();
      linkEntity.id = randomUUID();
      linkEntity.testResultId = entity.id;
      linkEntity.name = truncate(link.getName(), 255);
      linkEntity.url = link.getUrl();
      linkEntity.type = truncate(link.getType(), 50);
      return linkEntity;
    });

    entity.steps = domain.getSteps().map((step) => StepMapper.toEntity(step, entity.id, null));

    return entity;
  }

  static toDomain(entity: TestResultEntity, related?: RelatedData): TestResult {
    const id = new TestResultId(entity.id);
    const name = new TestName(entity.name, entity.fullName || null);
    const status = new Status(entity.status);
    const timeRange = new TimeRange(entity.startTime, entity.stopTime);
    const historyId = entity.historyId ? new HistoryId(entity.historyId) : null;

    const testCase: TestCase | null = entity.testCaseId
      ? {
          id: entity.testCaseId,
          name: entity.name,
          fullName: entity.fullName || undefined
        }
      : null;

    const error = entity.error
      ? new TestError(
          entity.error.message || null,
          entity.error.trace || null,
          entity.error.actual || null,
          entity.error.expected || null
        )
      : null;

    const transition = entity.transition ? new StatusTransition(entity.transition) : null;

    const labels = (related?.labels || entity.labels || []).map(
      (labelEntity) => new Label(labelEntity.name, labelEntity.value)
    );

    const parameters = (related?.parameters || entity.parameters || []).map(
      (paramEntity) =>
        new Parameter(
          paramEntity.name,
          paramEntity.value ?? '',
          paramEntity.hidden,
          paramEntity.excluded,
          paramEntity.masked
        )
    );

    const links = (related?.links || entity.links || []).map(
      (linkEntity) => new Link(linkEntity.url, linkEntity.name, linkEntity.type)
    );

    const steps: Step[] =
      related?.steps && related.steps.length > 0
        ? related.steps.map((stepEntity) => StepMapper.toDomain(stepEntity))
        : [];

    const retries: TestResult[] = [];
    if (related?.retries && related.retries.length > 0) {
      // Convert retry entities to domain
      // This would require recursive conversion
    }

    return new TestResult(
      id,
      name,
      status,
      timeRange,
      entity.fullName,
      historyId,
      testCase,
      entity.environment,
      entity.description,
      entity.descriptionHtml,
      entity.precondition,
      entity.preconditionHtml,
      entity.expectedResult,
      entity.expectedResultHtml,
      error,
      entity.flaky,
      entity.muted,
      entity.known,
      entity.hidden,
      transition,
      null, // hostId
      null, // threadId
      labels,
      parameters,
      links,
      steps,
      retries,
      entity.sourceMetadata,
      null // runSelector
    );
  }

  static toEntities(domains: ReadonlyArray<TestResult>, launchId: string): TestResultEntity[] {
    return domains.map((domain) => this.toEntity(domain, launchId));
  }

  static toDomains(entities: TestResultEntity[], related?: RelatedData[]): TestResult[] {
    return entities.map((entity, index) => this.toDomain(entity, related?.[index]));
  }
}
