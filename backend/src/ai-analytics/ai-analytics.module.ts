// backend/src/ai-analytics/ai-analytics.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiAnalyticsController } from './ai-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [AiAnalyticsController],
  providers: [AiAnalyticsService],
  exports: [AiAnalyticsService],
})
export class AiAnalyticsModule {}