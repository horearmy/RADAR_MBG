import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ExceptionController } from './exception.controller.js';
import { ExceptionService } from './exception.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ExceptionController],
  providers: [ExceptionService],
  exports: [ExceptionService],
})
export class ExceptionModule {}
