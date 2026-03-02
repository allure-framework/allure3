import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { LaunchEntity } from './LaunchEntity.js';
import type { EnvironmentItem, TestError } from '@allurereport/core-api';

@Entity('launch_globals')
export class LaunchGlobalsEntity {
  @PrimaryColumn({ type: 'uuid', name: 'launch_id' })
  launchId!: string;

  @Column({ type: 'integer', name: 'exit_code_original', default: 0 })
  exitCodeOriginal!: number;

  @Column({ type: 'integer', name: 'exit_code_actual', nullable: true })
  exitCodeActual!: number | null;

  @Column({ type: 'jsonb', default: [] })
  errors!: TestError[];

  @Column({ type: 'jsonb', name: 'allure_environment', default: [] })
  allureEnvironment!: EnvironmentItem[];

  @OneToOne(() => LaunchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'launch_id' })
  launch!: LaunchEntity;
}
