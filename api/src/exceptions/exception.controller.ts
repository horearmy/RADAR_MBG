import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  AssignExceptionDto,
  CloseExceptionDto,
  CreateExceptionDto,
  EscalateExceptionDto,
  InvestigateExceptionDto,
  ListExceptionAssigneesDto,
  ListExceptionsDto,
  ResolveExceptionDto,
  TriageExceptionDto,
} from './exception.dto.js';
import { ExceptionService } from './exception.service.js';

@Controller('exceptions')
@UseGuards(SessionGuard, PermissionGuard)
export class ExceptionController {
  constructor(private readonly exceptions: ExceptionService) {}

  @Get()
  @RequirePermissions('exception:read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListExceptionsDto) {
    return this.exceptions.list(request.principal!, query);
  }

  @Get('assignees')
  @RequirePermissions('exception:manage')
  listAssignees(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListExceptionAssigneesDto,
  ) {
    return this.exceptions.listAssignees(request.principal!, query);
  }

  @Get(':id')
  @RequirePermissions('exception:read')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exceptions.get(request.principal!, id);
  }

  @Post()
  @RequirePermissions('exception:manage')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.create(
      request.principal!,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/triage')
  @RequirePermissions('exception:manage')
  triage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TriageExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.triage(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/assign')
  @RequirePermissions('exception:manage')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.assign(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/investigate')
  @RequirePermissions('exception:manage')
  investigate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: InvestigateExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.investigate(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/resolve')
  @RequirePermissions('exception:manage')
  resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ResolveExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.resolve(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/escalate')
  @RequirePermissions('exception:manage')
  escalate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: EscalateExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.escalate(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post(':id/close')
  @RequirePermissions('exception:manage')
  close(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CloseExceptionDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.exceptions.close(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  private safeRequestId(candidate?: string) {
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
