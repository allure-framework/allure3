import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { TestResultEntity } from './TestResultEntity.js';

@Entity('parameters')
@Index('idx_parameters_test_result_id', ['testResultId'])
export class ParameterEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'test_result_id' })
  testResultId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  value!: string | null;

  @Column({ type: 'boolean', default: false })
  hidden!: boolean;

  @Column({ type: 'boolean', default: false })
  excluded!: boolean;

  @Column({ type: 'boolean', default: false })
  masked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TestResultEntity, (testResult) => testResult.parameters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_result_id' })
  testResult!: TestResultEntity;
}
