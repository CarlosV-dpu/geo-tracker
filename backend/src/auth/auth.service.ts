import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // 👈 Importación relativa correcta a tu estructura
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

export class RegisterDto {
  name!: string;
  cedula!: string;
  email!: string;
  password!: string;
  role?: Role;
}

export class LoginDto {
  email!: string;
  password!: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService,
    private jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    // 1. Solo permitir roles DRIVER u OTHER en el registro público
    const allowedPublicRoles: Role[] = [Role.DRIVER, Role.OTHER];
    const selectedRole = dto.role && allowedPublicRoles.includes(dto.role) ? dto.role : Role.DRIVER;

    // 2. Verificar si el correo o cédula ya existen
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { cedula: dto.cedula },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new BadRequestException('El correo ya está registrado');
      }
      if (existingUser.cedula === dto.cedula) {
        throw new BadRequestException('La cédula ya está registrada');
      }
    }

    // 3. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 4. Crear usuario en PostgreSQL mediante Prisma
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        cedula: dto.cedula,
        email: dto.email,
        password: hashedPassword,
        role: selectedRole,
      },
    });

    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
  async login(dto: LoginDto) {
    // 1. Buscar usuario por correo
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // 2. Comparar contraseña encriptada
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // 3. Generar Payload del JWT
    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    const token = this.jwtService.sign(payload);

    const { password, ...userWithoutPassword } = user;

    // 4. Retornar estructura idéntica a la que espera React
    return {
      access_token: token,
      user: userWithoutPassword,
    };
  }
}