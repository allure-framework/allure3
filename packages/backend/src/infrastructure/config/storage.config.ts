import { config } from 'dotenv';
import type { FileSystemStorageConfig } from '../external/storage/FileSystemStorage.js';
import type { RedisCacheConfig } from '../external/cache/RedisCacheService.js';

config();

export interface StorageConfig {
  type: 'filesystem' | 's3' | 'minio';
  filesystem?: FileSystemStorageConfig;
  s3?: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  minio?: {
    endpoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
    bucket: string;
    useSSL: boolean;
  };
}

export function getStorageConfig(): StorageConfig {
  const storageType = (process.env.STORAGE_TYPE || 'filesystem') as 'filesystem' | 's3' | 'minio';

  const config: StorageConfig = {
    type: storageType
  };

  if (storageType === 'filesystem') {
    config.filesystem = {
      baseDirectory: process.env.STORAGE_BASE_DIRECTORY || './storage/attachments',
      subdirectoryStructure: (process.env.STORAGE_SUBDIRECTORY_STRUCTURE as any) || 'flat',
      maxFileSize: process.env.STORAGE_MAX_FILE_SIZE
        ? parseInt(process.env.STORAGE_MAX_FILE_SIZE)
        : undefined
    };
  } else if (storageType === 's3') {
    config.s3 = {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT
    };
  } else if (storageType === 'minio') {
    config.minio = {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
      bucket: process.env.MINIO_BUCKET || 'attachments',
      useSSL: process.env.MINIO_USE_SSL === 'true'
    };
  }

  return config;
}
