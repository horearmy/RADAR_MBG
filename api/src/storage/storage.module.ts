import { Module } from '@nestjs/common';
import { PrivateStorageService } from './storage.service.js';

@Module({
  providers: [PrivateStorageService],
  exports: [PrivateStorageService],
})
export class StorageModule {}
