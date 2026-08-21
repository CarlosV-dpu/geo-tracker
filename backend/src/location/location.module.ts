import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LocationGateway } from './location.gateway';
import { LocationController } from './location.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_key', // Usa tu clave secreta del .env
      signOptions: { expiresIn: '48h' },
    }),
  ],
  controllers: [LocationController],
  providers: [LocationGateway, PrismaService],
})
export class LocationModule {}