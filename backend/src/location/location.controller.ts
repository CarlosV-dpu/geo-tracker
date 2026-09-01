import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('location')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('history/:identity')
  async getRouteHistory(@Param('identity') identity: string) {
    // Obtenemos las posiciones de la ruta ordenadas por fecha/hora
    const positions = await this.prisma.vehiclePosition.findMany({
      where: {
        route: {
          identity: identity,
        },
      },
      orderBy: {
         timestamp: 'asc',
        },
    });

    return positions;
  }

  @Get('active')
  async getActiveRoute() {
    // Busca la última ruta que esté activa en la base de datos
    const activeRoute = await this.prisma.route.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      positions: {
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  return activeRoute;
  }
}
