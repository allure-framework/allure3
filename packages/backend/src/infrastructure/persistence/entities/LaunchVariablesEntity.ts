import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { LaunchEntity } from './LaunchEntity.js';

export type ReportVariables = Record<string, string>;

@Entity('launch_variables')
export class LaunchVariablesEntity {
  @PrimaryColumn({ type: 'uuid', name: 'launch_id' })
  launchId!: string;

  @Column({ type: 'jsonb', default: {} })
  variables!: ReportVariables;

  @OneToOne(() => LaunchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'launch_id' })
  launch!: LaunchEntity;
}
