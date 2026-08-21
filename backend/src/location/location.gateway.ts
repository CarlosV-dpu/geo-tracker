import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extraemos el token desde el cliente (sea por auth objeto o headers)
      const authHeader = client.handshake.headers?.authorization;
      const token =
        client.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

      if (!token) {
        console.log(`❌ Conexión rechazada (Sin Token) -> ID: ${client.id}`);
        client.disconnect();
        return;
      }

      // Validar el token JWT
      const payload = await this.jwtService.verifyAsync(token);

      // Guardamos la información del usuario en la sesión de este socket específico
      client.data.user = payload;
      console.log(`⚡ Cliente Autenticado -> ID: ${client.id} | Email: ${payload.email} | Rol: ${payload.role}`);
    } catch (error) {
      console.log(`❌ Conexión rechazada (Token Inválido) -> ID: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Cliente Desconectado -> ID: ${client.id}`);
  }

  // 3. Unirse a la sala (Cualquier rol autenticado ADMIN, DRIVER, ROOT puede escuchar)
  @SubscribeMessage('joinRoute')
  handleJoinRoute(
    @MessageBody() data: { routeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`route_${data.routeId}`);
    return { event: 'joinedRoute', routeId: data.routeId };
  }

  // 4. Transmitir ubicación (Protegido solo para DRIVER y ROOT)
  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() payload: { routeId: string; lat: number; lng: number; speed?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    // Control de acceso por rol
    if (!user || (user.role !== Role.DRIVER && user.role !== Role.ROOT)) {
      return { 
        status: 'error', 
        message: 'Acceso denegado: Solo un Conductor (DRIVER) o ROOT puede emitir ubicaciones.' 
      };
    }

    const { routeId, lat, lng, speed = 0 } = payload;

    const newPosition = await this.prisma.vehiclePosition.create({
      data: {
        route: {
          connectOrCreate: {
            where: { id: routeId },
            create: { id: routeId, name: 'Ruta de Prueba' },
          },
        },
        lat,
        lng,
        speed,
      },
    });

    // Emitir la nueva posición a todos los escuchas (ADMINs / Supervisores) en esa sala
    this.server.to(`route_${routeId}`).emit('locationUpdated', newPosition);

    return { status: 'success', data: newPosition };
  }
}
