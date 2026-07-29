import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LocationModule } from './location/location.module';

@Module({
  imports: [PrismaModule, LocationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
