import { 
  Controller, Get, Patch, Delete ,Body, Param,
  ParseIntPipe, UseGuards, BadRequestException,
  NotFoundException, ForbiddenException, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guards';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ROOT)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}
  // --- GESTIÓN DE USUARIOS ---
  // Consulta de todos los usuarios
  @Get('users')
  async getAllUsers(@Req() req: any) {
    const currentUserRole = req.user?.role;
    // Filtro base: solo usuarios con Visible = 1
    const whereCondition: any = { Visible: 1 };
    // Si quien consulta es ADMIN, se omiten los usuarios con rol ROOT
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

  // Actualizar datos del usuario (Nombre, Cédula, Email, Rol)
  @Patch('users/:id')
  async updateUser(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; cedula?: string; email?: string; role?: Role },
  ) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Usuario no encontrado');
    // Un ADMIN no puede modificar a un usuario ROOT
    if (req.user?.role === Role.ADMIN && targetUser.role === Role.ROOT) {
      throw new ForbiddenException('No tienes permisos para editar a un usuario ROOT.');
    }
    // Validar duplicados de cédula o correo si cambian
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
  // Eliminación lógica: Cambia el campo Visible a 0
  @Delete('users/:id')
  async softDeleteUser(@Req() req: any,@Param('id', ParseIntPipe) id: number) {
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
  // Historial de rutas para revisión administrativa
  @Get('routes')
  async getAllRoutes(@Req() req: any) {
    const currentUserRole = req.user?.role;
    // Filtro base: solo rutas con Visible = 1
    const whereCondition: any = { Visible: 1 };
    // Si quien consulta es ADMIN, se excluyen las rutas cuyos conductores sean ROOT
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

  // Eliminación lógica de una ruta: Cambia el campo Visible a 0
  @Delete('routes/:id')
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
  async updateRouteDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: { identity?: string; name?: string; 
      description?: string; driverId?: number;
      isActive?: boolean },
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