import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from './prisma/prisma.module';
import { LocationModule } from './location/location.module';
import { AuthModule } from './auth/auth.module';
import { AiAnalyticsModule } from './ai-analytics/ai-analytics.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LocationModule,
    AuthModule,
    AiAnalyticsModule
  ],
  controllers: [AdminController],
  providers: [],
})
export class AppModule {}