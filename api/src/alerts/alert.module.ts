import { Module } from '@nestjs/common';
import { ExceptionModule } from '../exceptions/exception.module.js';
import { AlertWorkerService } from './alert-worker.service.js';

@Module({
  imports: [ExceptionModule],
  providers: [AlertWorkerService],
})
export class AlertModule {}
