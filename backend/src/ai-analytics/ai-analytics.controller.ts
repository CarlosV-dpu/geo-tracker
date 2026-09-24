// backend/src/ai-analytics/ai-analytics.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiAnalyticsController {
  constructor(private readonly aiService: AiAnalyticsService) {}

  @Post('query')
  async handleQuery(@Body() body: { prompt: string }) {
    return this.aiService.processUserQuery(body.prompt);
  }
}