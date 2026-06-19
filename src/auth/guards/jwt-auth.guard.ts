import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenPayload } from '../interfaces/auth-token-payload.interface';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';

const AUTHENTICATED_USER_INCLUDE = {
  role: {
    include: {
      rolePermissions: {
        where: {
          deletedAt: null,
        },
        include: {
          permission: true,
        },
      },
    },
  },
  userPermissions: {
    where: {
      deletedAt: null,
    },
    include: {
      permission: true,
    },
  },
} satisfies Prisma.UserInclude;

type AuthenticatedUserPayload = Prisma.UserGetPayload<{
  include: typeof AUTHENTICATED_USER_INCLUDE;
}>;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentification requise.');
    }

    const payload = await this.verifyToken(token);
    const user = await this.findActiveUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable ou inactif.');
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role.label,
      permissions: this.getPermissionCodes(user),
    };

    return true;
  }

  private extractAccessToken(request: AuthenticatedRequest): string | null {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const accessTokenCookie = cookies.find((cookie) =>
      cookie.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`),
    );

    if (!accessTokenCookie) {
      return null;
    }

    return decodeURIComponent(
      accessTokenCookie.slice(ACCESS_TOKEN_COOKIE_NAME.length + 1),
    );
  }

  private async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré.');
    }
  }

  private async findActiveUser(
    userId: number,
  ): Promise<AuthenticatedUserPayload | null> {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: AUTHENTICATED_USER_INCLUDE,
    });
  }

  private getPermissionCodes(user: AuthenticatedUserPayload): string[] {
    const userPermissionCodes = user.userPermissions.map(
      (userPermission) => userPermission.permission.code,
    );
    const rolePermissionCodes = user.role.rolePermissions.map(
      (rolePermission) => rolePermission.permission.code,
    );

    return Array.from(
      new Set([...userPermissionCodes, ...rolePermissionCodes]),
    );
  }
}
