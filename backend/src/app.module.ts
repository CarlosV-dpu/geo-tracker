import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from './prisma/prisma.module';
import { LocationModule } from './location/location.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, LocationModule, AuthModule],
  controllers: [AdminController],
  providers: [],
})
export class AppModule {}