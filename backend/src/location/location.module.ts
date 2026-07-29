import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';

@Module({
  providers: [LocationGateway],
})
export class LocationModule {}