import { DataSource, Repository, In } from 'typeorm';
import { ITestResultRepository } from '../../../../domain/repositories/ITestResultRepository.js';
import { TestResult } from '../../../../domain/entities/TestResult.js';
import { TestResultId } from '../../../../domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../domain/value-objects/LaunchId.js';
import { HistoryId } from '../../../../domain/value-objects/HistoryId.js';
import { Status } from '../../../../domain/value-objects/Status.js';
import { TestResultEntity } from '../entities/TestResultEntity.js';
import { LabelEntity } from '../entities/LabelEntity.js';
import { ParameterEntity } from '../entities/ParameterEntity.js';
import { LinkEntity } from '../entities/LinkEntity.js';
import { StepEntity } from '../entities/StepEntity.js';
import { TestResultMapper, RelatedData } from './mappers/TestResultMapper.js';

export class TestResultRepository implements ITestResultRepository {
  private repository: Repository<TestResultEntity>;
  private labelRepository: Repository<LabelEntity>;
  private parameterRepository: Repository<ParameterEntity>;
  private linkRepository: Repository<LinkEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository('TestResultEntity') as Repository<TestResultEntity>;
    this.labelRepository = this.dataSource.getRepository('LabelEntity') as Repository<LabelEntity>;
    this.parameterRepository = this.dataSource.getRepository('ParameterEntity') as Repository<ParameterEntity>;
    this.linkRepository = this.dataSource.getRepository('LinkEntity') as Repository<LinkEntity>;
  }

  async save(result: TestResult): Promise<void> {
    // Note: launchId needs to be provided - this is a limitation
    // In production, this should be passed as a parameter or extracted from context
    // For now, we'll use an empty string which will cause an error
    // This needs to be fixed by adding launchId parameter to save method
    throw new Error('TestResultRepository.save requires launchId - use saveWithLaunchId instead');
  }

  async saveWithLaunchId(result: TestResult, launchId: string): Promise<void> {
    const entity = TestResultMapper.toEntity(result, launchId);
    const existing = await this.repository.findOne({ where: { id: entity.id } });
    if (existing) {
      await this.repository.update(entity.id, {
        launchId: entity.launchId,
        historyId: entity.historyId,
        testCaseId: entity.testCaseId,
        name: entity.name,
        fullName: entity.fullName,
        status: entity.status,
        environment: entity.environment,
        startTime: entity.startTime,
        stopTime: entity.stopTime,
        duration: entity.duration,
        description: entity.description,
        descriptionHtml: entity.descriptionHtml,
        precondition: entity.precondition,
        preconditionHtml: entity.preconditionHtml,
        expectedResult: entity.expectedResult,
        expectedResultHtml: entity.expectedResultHtml,
        flaky: entity.flaky,
        muted: entity.muted,
        known: entity.known,
        hidden: entity.hidden,
        transition: entity.transition,
        error: entity.error,
        sourceMetadata: entity.sourceMetadata
      });
      await this.labelRepository.delete({ testResultId: entity.id });
      await this.parameterRepository.delete({ testResultId: entity.id });
      await this.linkRepository.delete({ testResultId: entity.id });
      const stepRepo = this.dataSource.getRepository(StepEntity);
      await stepRepo.delete({ testResultId: entity.id });
      const labels = entity.labels ?? [];
      const parameters = entity.parameters ?? [];
      const links = entity.links ?? [];
      const steps = entity.steps ?? [];
      if (labels.length > 0) await this.labelRepository.insert(labels);
      if (parameters.length > 0) await this.parameterRepository.insert(parameters);
      if (links.length > 0) await this.linkRepository.insert(links);
      if (steps.length > 0) await stepRepo.insert(steps);
      return;
    }
    await this.repository.insert(entity);
    const labels = entity.labels ?? [];
    const parameters = entity.parameters ?? [];
    const links = entity.links ?? [];
    const steps = entity.steps ?? [];
    if (labels.length > 0) await this.labelRepository.insert(labels);
    if (parameters.length > 0) await this.parameterRepository.insert(parameters);
    if (links.length > 0) await this.linkRepository.insert(links);
    if (steps.length > 0) await this.dataSource.getRepository(StepEntity).insert(steps);
  }

  async saveMany(results: ReadonlyArray<TestResult>): Promise<void> {
    if (results.length === 0) {
      return;
    }

    // Extract launchId from first result's context or throw error
    // This is a limitation - in production, launchId should be passed explicitly
    // For now, we'll need to get it from a shared context or pass it differently
    throw new Error('saveMany requires launchId - use saveManyWithLaunchId instead');
  }

  async saveManyWithLaunchId(results: ReadonlyArray<TestResult>, launchId: string): Promise<void> {
    if (results.length === 0) {
      return;
    }

    const entities = TestResultMapper.toEntities(results, launchId);

    // Save all entities in a transaction (use entity names so metadata lookup works under Vitest)
    await this.dataSource.transaction(async (manager) => {
      await manager.save('TestResultEntity', entities);

      const allLabels: LabelEntity[] = [];
      const allParameters: ParameterEntity[] = [];
      const allLinks: LinkEntity[] = [];
      const allSteps: StepEntity[] = [];

      for (const entity of entities) {
        if (entity.labels) {
          allLabels.push(...entity.labels);
        }
        if (entity.parameters) {
          allParameters.push(...entity.parameters);
        }
        if (entity.links) {
          allLinks.push(...entity.links);
        }
        if (entity.steps) {
          allSteps.push(...entity.steps);
        }
      }

      if (allLabels.length > 0) {
        await manager.save('LabelEntity', allLabels);
      }
      if (allParameters.length > 0) {
        await manager.save('ParameterEntity', allParameters);
      }
      if (allLinks.length > 0) {
        await manager.save('LinkEntity', allLinks);
      }
      if (allSteps.length > 0) {
        await manager.save('StepEntity', allSteps);
      }
    });
  }

  async findById(id: TestResultId): Promise<TestResult | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() },
      relations: ['labels', 'parameters', 'links', 'steps']
    });

    if (!entity) {
      return null;
    }

    const related: RelatedData = {
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    };

    return TestResultMapper.toDomain(entity, related);
  }

  async findByLaunchId(launchId: LaunchId): Promise<TestResult[]> {
    const entities = await this.repository.find({
      where: { launchId: launchId.getValue() },
      relations: ['labels', 'parameters', 'links', 'steps'],
      order: { startTime: 'DESC' }
    });

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async findByLaunchIds(launchIds: string[]): Promise<TestResult[]> {
    if (launchIds.length === 0) {
      return [];
    }
    const entities = await this.repository.find({
      where: { launchId: In(launchIds) },
      relations: ['labels', 'parameters', 'links', 'steps'],
      order: { startTime: 'DESC' }
    });

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async findByTestCaseIdAndLaunchIds(testCaseId: string, launchIds: string[]): Promise<TestResult[]> {
    if (launchIds.length === 0) {
      return [];
    }
    const entities = await this.repository.find({
      where: { testCaseId, launchId: In(launchIds) },
      relations: ['labels', 'parameters', 'links', 'steps'],
      order: { startTime: 'DESC' }
    });

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async findByHistoryId(historyId: HistoryId): Promise<TestResult[]> {
    const entities = await this.repository.find({
      where: { historyId: historyId.getValue() },
      relations: ['labels', 'parameters', 'links', 'steps'],
      order: { startTime: 'DESC' }
    });

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async findByStatus(status: Status): Promise<TestResult[]> {
    const entities = await this.repository.find({
      where: { status: status.getValue() },
      relations: ['labels', 'parameters', 'links', 'steps'],
      order: { startTime: 'DESC' }
    });

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async findDistinctTagValuesByLaunchIds(launchIds: string[]): Promise<string[]> {
    if (launchIds.length === 0) {
      return [];
    }
    const rows = await this.labelRepository
      .createQueryBuilder('l')
      .select('DISTINCT l.value', 'value')
      .innerJoin('l.testResult', 'tr')
      .where('tr.launchId IN (:...launchIds)', { launchIds })
      .andWhere('l.name = :name', { name: 'tag' })
      .andWhere('l.value IS NOT NULL')
      .orderBy('l.value', 'ASC')
      .getRawMany<{ value: string }>();
    return rows.map((r) => r.value);
  }

  async findByLabel(labelName: string, labelValue?: string): Promise<TestResult[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('tr')
      .leftJoinAndSelect('tr.labels', 'label')
      .leftJoinAndSelect('tr.parameters', 'parameter')
      .leftJoinAndSelect('tr.links', 'link')
      .leftJoinAndSelect('tr.steps', 'step')
      .where('label.name = :labelName', { labelName });

    if (labelValue !== undefined) {
      queryBuilder.andWhere('label.value = :labelValue', { labelValue });
    }

    const entities = await queryBuilder.orderBy('tr.startTime', 'DESC').getMany();

    const related: RelatedData[] = entities.map((entity) => ({
      labels: entity.labels,
      parameters: entity.parameters,
      links: entity.links,
      steps: entity.steps
    }));

    return TestResultMapper.toDomains(entities, related);
  }

  async delete(id: TestResultId): Promise<void> {
    await this.repository.delete(id.getValue());
  }

  async exists(id: TestResultId): Promise<boolean> {
    const count = await this.repository.count({
      where: { id: id.getValue() }
    });
    return count > 0;
  }
}
