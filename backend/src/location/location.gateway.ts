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

    // Control de acceso por rol
    if (!user || (user.role !== Role.DRIVER && user.role !== Role.ROOT)) {
      return { 
        status: 'error', 
        message: 'Acceso denegado: Solo un Conductor (DRIVER) o ROOT puede emitir ubicaciones.' 
      };
    }

    const { identity, name, description, driverId, lat, lng, speed = 0 } = payload;

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
              name: name ||'Ruta de Prueba',
              description: description || 'Cargamento de ropa',
              driver: {
                connect: { id: Number(driverId)},
              },
            },
          },
        },
        lat,
        lng,
        speed,
      },
    });

    // Emitir la nueva posición a todos los escuchas (ADMINs / Supervisores) en esa sala
    this.server.to(`route_${identity}`).emit('locationUpdated', newPosition);

    return { status: 'success', data: newPosition };
  }

  // Agrega este método dentro de location.gateway.ts
@SubscribeMessage('finishRoute')
async handleFinishRoute(
  @MessageBody() payload: { identity: string; name?: string },
) {
  const identity = payload.identity;
  const name = payload.name || 'Ruta 1'; // Fallback por seguridad

  if (!identity) {
    return { status: 'error', message: 'Se requiere identity para finalizar la ruta.' };
  }

  // Actualización utilizando la clave compuesta sin tocar la base de datos
  const updatedRoute = await this.prisma.route.update({
    where: { 
      identity_name: {
        identity: identity,
        name: name,
      },
    },
    data: { isActive: false },
  });

  // Notificar a los clientes conectados a la sala de la ruta
  this.server.to(`route_${identity}`).emit('routeFinished', updatedRoute);

  return { status: 'success', data: updatedRoute };
}
}
