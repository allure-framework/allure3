import { Launch } from '../../../../domain/entities/Launch.js';
import { LaunchId } from '../../../../domain/value-objects/LaunchId.js';
import { ExecutorInfo } from '../../../../domain/value-objects/ExecutorInfo.js';
import { LaunchEntity } from '../../entities/LaunchEntity.js';
import { TestResultMapper } from './TestResultMapper.js';

export class LaunchMapper {
  static toEntity(domain: Launch): LaunchEntity {
    const entity = new LaunchEntity();
    entity.id = domain.getId().getValue();
    entity.name = domain.getName();
    entity.startTime = domain.getStartTime();
    entity.stopTime = domain.getStopTime();
    entity.environment = domain.getEnvironment();
    entity.reportUuid = domain.getReportUuid();
    const parentId = domain.getParentLaunchId();
    entity.parentLaunchId = parentId ? parentId.getValue() : null;
    entity.runKey = domain.getRunKey();

    const executor = domain.getExecutor();
    if (executor) {
      entity.executor = {
        name: executor.getName(),
        type: executor.getType(),
        url: executor.getUrl(),
        buildOrder: executor.getBuildOrder(),
        buildName: executor.getBuildName(),
        buildUrl: executor.getBuildUrl(),
        reportName: executor.getReportName(),
        reportUrl: executor.getReportUrl()
      };
    } else {
      entity.executor = null;
    }

    return entity;
  }

  static toDomain(entity: LaunchEntity): Launch {
    const id = new LaunchId(entity.id);
    const executor = entity.executor
      ? new ExecutorInfo(
          entity.executor.name || null,
          entity.executor.type || null,
          entity.executor.url || null,
          entity.executor.buildOrder || null,
          entity.executor.buildName || null,
          entity.executor.buildUrl || null,
          entity.executor.reportName || null,
          entity.executor.reportUrl || null
        )
      : null;

    const parentLaunchId = entity.parentLaunchId ? new LaunchId(entity.parentLaunchId) : null;
    const launch = new Launch(
      id,
      entity.name,
      entity.startTime,
      entity.stopTime,
      executor,
      entity.environment,
      entity.reportUuid,
      parentLaunchId,
      entity.runKey
    );

    // Add test results if they were loaded (use hydration path so completed launches can have results)
    if (entity.testResults && entity.testResults.length > 0) {
      for (const testResultEntity of entity.testResults) {
        const related = {
          labels: testResultEntity.labels || [],
          parameters: testResultEntity.parameters || [],
          links: testResultEntity.links || []
        };
        const testResult = TestResultMapper.toDomain(testResultEntity, related);
        launch.addTestResultFromPersistence(testResult);
      }
    }

    return launch;
  }
}
