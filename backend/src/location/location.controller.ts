import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('location')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('history/:routeId')
  async getRouteHistory(@Param('routeId') routeId: string) {
    // Obtenemos las posiciones de la ruta ordenadas por fecha/hora
    const positions = await this.prisma.vehiclePosition.findMany({
      where: { routeId },
      orderBy: { timestamp: 'asc' },
    });

    return positions;
  }
}