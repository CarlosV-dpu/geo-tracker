import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado o formato inválido');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = process.env.JWT_SECRET || 'geotracker_secret_key_2026';
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.user = payload; // Adjunta el usuario para que RolesGuard lea request.user.role
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}