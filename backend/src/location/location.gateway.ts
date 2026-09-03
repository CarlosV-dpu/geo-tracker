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
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers?.authorization;
      const token =
        client.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

      if (!token) {
        console.log(`❌ Conexión rechazada (Sin Token) -> ID: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
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

  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() payload: { 
      identity: string;
      name: string;
      description: string;
      driverId: number;
      lat: number;
      lng: number;
      speed?: number
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    if (!user || (user.role !== Role.DRIVER && user.role !== Role.ROOT && user.role !== Role.ADMIN)) {
      return { 
        status: 'error', 
        message: 'Acceso denegado: Solo un Conductor (DRIVER) puede emitir ubicaciones.'
      };
    }

    const { identity, name, description, lat, lng, speed = 0 } = payload;
    const effectiveDriverId = Number(user.sub || user.id || payload.driverId);
    const driverName = user.name || `Conductor #${effectiveDriverId}`;

    const newPosition = await this.prisma.vehiclePosition.create({
      data: {
        route: {
          connectOrCreate: {
            where: { 
              identity_name: {
                identity: identity,
                name: name
              }
            },
            create: { 
              identity: identity,
              name: name || 'Ruta de Prueba',
              description: description || 'Cargamento de mercancía',
              driver: {
                connect: { id: effectiveDriverId },
              },
            },
          },
        },
        lat,
        lng,
        speed,
      },
    });

    // Se construye el payload asegurando enviar identity y name de la RUTA
    const locationPayload = {
      driverId: effectiveDriverId,
      driverName: driverName,
      identity: identity,
      name: name,
      lat: newPosition.lat,
      lng: newPosition.lng,
      speed: newPosition.speed,
      timestamp: newPosition.timestamp,
    };

    // Emitir globalmente a todos los clientes conectados (Mapas de monitoreo)
    this.server.emit('locationUpdated', locationPayload);

    return { status: 'success', data: locationPayload };
  }

  @SubscribeMessage('finishRoute')
  async handleFinishRoute(
    @MessageBody() payload: { identity: string; name?: string },
  ) {
    const identity = payload.identity;

    if (!identity) {
      return { status: 'error', message: 'Se requiere identity para finalizar la ruta.' };
    }

    // Desactivar la ruta activa por su identity de forma limpia
    await this.prisma.route.updateMany({
      where: { identity: identity, isActive: true },
      data: { isActive: false },
    });

    this.server.emit('routeFinished', { identity });

    return { status: 'success' };
  }
}