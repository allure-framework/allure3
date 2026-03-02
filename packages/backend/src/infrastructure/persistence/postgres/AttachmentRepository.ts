import { DataSource, In, IsNull, Repository } from 'typeorm';
import type { IAttachmentRepository, SaveAttachmentMetadata } from '../../../../domain/repositories/IAttachmentRepository.js';
import { Attachment } from '../../../../domain/entities/Attachment.js';
import { AttachmentId } from '../../../../domain/value-objects/AttachmentId.js';
import { AttachmentEntity } from '../entities/AttachmentEntity.js';
import { AttachmentMapper } from './mappers/AttachmentMapper.js';

export class AttachmentRepository implements IAttachmentRepository {
  private repository: Repository<AttachmentEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository('AttachmentEntity') as Repository<AttachmentEntity>;
  }

  async save(attachment: Attachment, metadata?: SaveAttachmentMetadata): Promise<void> {
    const entity = AttachmentMapper.toEntity(attachment, metadata);
    await this.repository.save(entity);
  }

  async findGlobalByLaunchIds(launchIds: string[]): Promise<Array<{ uid: string; name: string | null; contentType: string | null; originalFileName: string | null }>> {
    if (launchIds.length === 0) {
      return [];
    }
    const entities = await this.repository.find({
      where: {
        launchId: In(launchIds),
        testResultId: IsNull()
      },
      select: ['uid', 'name', 'contentType', 'originalFileName']
    });
    return entities.map((e) => ({
      uid: e.uid,
      name: e.name,
      contentType: e.contentType,
      originalFileName: e.originalFileName
    }));
  }

  async findById(id: AttachmentId): Promise<Attachment | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() }
    });

    if (!entity) {
      return null;
    }

    return AttachmentMapper.toDomain(entity);
  }

  async findByUid(uid: string): Promise<Attachment | null> {
    const entity = await this.repository.findOne({
      where: { uid }
    });

    if (!entity) {
      return null;
    }

    return AttachmentMapper.toDomain(entity);
  }

  async delete(id: AttachmentId): Promise<void> {
    await this.repository.delete(id.getValue());
  }

  async exists(id: AttachmentId): Promise<boolean> {
    const count = await this.repository.count({
      where: { id: id.getValue() }
    });
    return count > 0;
  }
}
