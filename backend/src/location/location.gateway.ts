import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}


  @SubscribeMessage('joinRoute')
  handleJoinRoute(
    @MessageBody() data: { routeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`route_${data.routeId}`);
    return { event: 'joinedRoute', routeId: data.routeId };
  }


  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() payload: { routeId: string; lat: number; lng: number; speed?: number },
  ) {
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
    
    this.server.to(`route_${routeId}`).emit('locationUpdated', newPosition);

    return { status: 'success', data: newPosition };
  }
}
