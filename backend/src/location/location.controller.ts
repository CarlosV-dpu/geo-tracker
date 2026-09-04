import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Location')
@Controller('location')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('history/:identity')
  @ApiOperation({ summary: 'Obtener historial de posiciones GPS de una ruta especifica' })
  @ApiParam({ name: 'identity', description: 'Código o Identificador de la ruta', example: 'RT-1001' })
  @ApiResponse({ status: 200, description: 'Lista de coordenadas ordenadas cronológicamente.' })
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
  @ApiOperation({ summary: 'Obtener la última ruta activa en el sistema' })
  @ApiResponse({ status: 200, description: 'Detalle de la ruta en curso con sus posiciones.' })
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
