import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { RecipientController } from './recipient.controller.js';
import { RecipientService } from './recipient.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [RecipientController],
  providers: [RecipientService],
})
export class RecipientModule {}
