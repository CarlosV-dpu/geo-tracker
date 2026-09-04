import { 
  Controller, Get, Patch, Delete, Body, Param,
  ParseIntPipe, UseGuards, BadRequestException,
  NotFoundException, ForbiddenException, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guards';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ROOT)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // --- GESTIÓN DE USUARIOS ---
  @Get('users')
  @ApiOperation({ summary: 'Obtener lista de usuarios visibles' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios retornada con éxito.' })
  @ApiResponse({ status: 401, description: 'Token no proporcionado o inválido.' })
  @ApiResponse({ status: 403, description: 'Acceso restringido a roles ADMIN o ROOT.' })
  async getAllUsers(@Req() req: any) {
    const currentUserRole = req.user?.role;
    const whereCondition: any = { Visible: 1 };
    if (currentUserRole === Role.ADMIN) {
      whereCondition.role = { not: Role.ROOT };
    }
    return this.prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        cedula: true,
        name: true,
        email: true,
        password: true,
        role: true,
        Visible: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Actualizar información de un usuario' })
  @ApiParam({ name: 'id', description: 'ID numérico del usuario', example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente.' })
  @ApiResponse({ status: 400, description: 'El correo o cédula ya están en uso.' })
  @ApiResponse({ status: 403, description: 'Un ADMIN no puede editar a un usuario ROOT.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async updateUser(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; cedula?: string; email?: string; role?: Role },
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Usuario no encontrado');
    if (req.user?.role === Role.ADMIN && targetUser.role === Role.ROOT) {
      throw new ForbiddenException('No tienes permisos para editar a un usuario ROOT.');
    }
    if (body.email || body.cedula) {
      const existing = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(body.email ? [{ email: body.email }] : []),
                ...(body.cedula ? [{ cedula: body.cedula }] : []),
              ],
            },
          ],
        },
      });

      if (existing) {
        if (existing.email === body.email) {
          throw new BadRequestException('El correo electrónico ya está en uso por otro usuario.');
        }
        if (existing.cedula === body.cedula) {
          throw new BadRequestException('La cédula ya está registrada para otro usuario.');
        }
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.cedula && { cedula: body.cedula }),
        ...(body.email && { email: body.email }),
        ...(body.role && { role: body.role }),
      },
      select: {
        id: true,
        cedula: true,
        name: true,
        email: true,
        password: true,
        role: true,
        Visible: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Eliminación lógica de usuario (Visible = 0)' })
  @ApiParam({ name: 'id', description: 'ID numérico del usuario', example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario ocultado correctamente.' })
  @ApiResponse({ status: 403, description: 'El usuario ROOT no puede ser eliminado.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async softDeleteUser(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Usuario no encontrado');

    if (targetUser.role === Role.ROOT) {
      throw new ForbiddenException('El usuario ROOT no puede ser eliminado.');
    }

    return this.prisma.user.update({
      where: { id },
      data: { Visible: 0 },
      select: { id: true, name: true, Visible: true },
    });
  }

  // --- GESTIÓN DE RUTAS ---
  @Get('routes')
  @ApiOperation({ summary: 'Obtener historial de rutas registradas' })
  @ApiResponse({ status: 200, description: 'Historial de rutas obtenido correctamente.' })
  async getAllRoutes(@Req() req: any) {
    const currentUserRole = req.user?.role;
    const whereCondition: any = { Visible: 1 };
    if (currentUserRole === Role.ADMIN) {
      whereCondition.driver = {
        role: { not: Role.ROOT },
      };
    }

    return this.prisma.route.findMany({
      where: whereCondition,
      include: {
        driver: { select: { id: true, name: true, cedula: true } },
        positions: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { lat: true, lng: true, timestamp: true },
        },
        _count: { select: { positions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete('routes/:id')
  @ApiOperation({ summary: 'Eliminación lógica de una ruta (Visible = 0)' })
  @ApiParam({ name: 'id', description: 'ID numérico de la ruta', example: 1 })
  @ApiResponse({ status: 200, description: 'Ruta desactivada correctamente.' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada.' })
  async softDeleteRoute(@Param('id', ParseIntPipe) id: number) {
    const targetRoute = await this.prisma.route.findUnique({ where: { id } });
    if (!targetRoute) throw new NotFoundException('Ruta no encontrada');

    return this.prisma.route.update({
      where: { id },
      data: { Visible: 0 },
      select: { id: true, identity: true, Visible: true },
    });
  }

  @Patch('routes/:id')
  @ApiOperation({ summary: 'Editar detalles de una ruta existente' })
  @ApiParam({ name: 'id', description: 'ID numérico de la ruta', example: 1 })
  @ApiResponse({ status: 200, description: 'Ruta actualizada con éxito.' })
  async updateRouteDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: { identity?: string; name?: string; description?: string; driverId?: number; isActive?: boolean },
  ) {
    return this.prisma.route.update({
      where: { id },
      data: payload,
      include: {
        driver: { select: { id: true, name: true, cedula: true } },
        positions: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { lat: true, lng: true, timestamp: true },
        },
        _count: { select: { positions: true } },
      },
    });
  }
}