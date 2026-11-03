import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevController } from './dev.controller.js';
import { DevModeGuard } from './dev-mode.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [DevController],
  providers: [DevModeGuard],
})
export class DevModule {}
