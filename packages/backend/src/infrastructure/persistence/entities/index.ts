import { LaunchEntity } from './LaunchEntity.js';
import { TestResultEntity } from './TestResultEntity.js';
import { LabelEntity } from './LabelEntity.js';
import { ParameterEntity } from './ParameterEntity.js';
import { LinkEntity } from './LinkEntity.js';
import { StepEntity } from './StepEntity.js';
import { RetryEntity } from './RetryEntity.js';
import { AttachmentEntity } from './AttachmentEntity.js';
import { HistoryEntity } from './HistoryEntity.js';
import { LaunchGlobalsEntity } from './LaunchGlobalsEntity.js';
import { LaunchVariablesEntity } from './LaunchVariablesEntity.js';

/** All TypeORM entities for DataSource (avoids dynamic .ts loading in Vitest). */
export const allEntities = [
  LaunchEntity,
  TestResultEntity,
  LabelEntity,
  ParameterEntity,
  LinkEntity,
  StepEntity,
  RetryEntity,
  AttachmentEntity,
  HistoryEntity,
  LaunchGlobalsEntity,
  LaunchVariablesEntity
];
