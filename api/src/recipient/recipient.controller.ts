import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { Req } from '@nestjs/common';
import { RecipientService } from './recipient.service.js';

@Controller('recipient')
@UseGuards(SessionGuard)
export class RecipientController {
  constructor(private readonly service: RecipientService) {}

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.service.getMe(req.principal!.id);
  }

  @Get('deliveries')
  deliveries(@Req() req: AuthenticatedRequest) {
    return this.service.listDeliveries(req.principal!.id);
  }

  @Get('stops/:stopId')
  stop(@Req() req: AuthenticatedRequest, @Param('stopId', ParseUUIDPipe) stopId: string) {
    return this.service.getStop(req.principal!.id, stopId);
  }

  @Get('stops/:stopId/pod')
  pod(@Req() req: AuthenticatedRequest, @Param('stopId', ParseUUIDPipe) stopId: string) {
    return this.service.getPod(req.principal!.id, stopId);
  }

  @Post('stops/:stopId/confirm')
  confirm(@Req() req: AuthenticatedRequest, @Param('stopId', ParseUUIDPipe) stopId: string) {
    return this.service.confirm(req.principal!.id, stopId);
  }

  @Post('stops/:stopId/report-issue')
  reportIssue(
    @Req() req: AuthenticatedRequest,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @Body() body: { category: string; description: string },
  ) {
    return this.service.reportIssue(req.principal!.id, stopId, body);
  }

  @Get('notifications')
  notifications(@Req() req: AuthenticatedRequest) {
    return this.service.listNotifications(req.principal!.id);
  }

  @Post('notifications/:id/read')
  markRead(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(req.principal!.id, id);
  }
}
