import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('location')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /location/history/:routeId
  @Get('history/:routeId')
  async getRouteHistory(@Param('routeId') routeId: string) {
    return this.prisma.vehiclePosition.findMany({
      where: { routeId },
      orderBy: { timestamp: 'asc' },
      select: {
        lat: true,
        lng: true,
        speed: true,
        timestamp: true,
      },
    });
  }
}