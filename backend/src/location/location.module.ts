import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';
import { LocationController } from './location.controller';

@Module({
  controllers: [LocationController],
  providers: [LocationGateway],
})
export class LocationModule {}