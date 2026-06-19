import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare } from 'bcryptjs';
import { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthTokenPayload } from './interfaces/auth-token-payload.interface';
import { LoginResponse } from './interfaces/login-response.interface';

const AUTH_USER_INCLUDE = {
  role: true,
  userPermissions: {
    where: {
      deletedAt: null,
    },
    include: {
      permission: true,
    },
  },
} satisfies Prisma.UserInclude;

export type AuthUser = Prisma.UserGetPayload<{
  include: typeof AUTH_USER_INCLUDE;
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.findActiveUserByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Aucun compte lié à cette adresse email');
    }

    const isPasswordValid = await compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Adresse email ou mot de passe incorrect',
      );
    }

    return this.generateTokens(user);
  }

  private async findActiveUserByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
        deletedAt: null,
      },
      include: AUTH_USER_INCLUDE,
    });
  }

  private async generateTokens(user: AuthUser): Promise<LoginResponse> {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.label,
      permissions: user.userPermissions.map(
        (userPermission) => userPermission.permission.code,
      ),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.getJwtExpiresIn('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.getJwtExpiresIn('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getJwtExpiresIn(configKey: string): StringValue {
    return this.configService.getOrThrow<StringValue>(configKey);
  }
}
