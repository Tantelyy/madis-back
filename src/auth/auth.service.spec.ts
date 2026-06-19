import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { AuthService, AuthUser } from './auth.service';
import { AuthTokenPayload } from './interfaces/auth-token-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const configValues: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  type FindUniqueArgs = Parameters<PrismaService['user']['findUnique']>[0];

  let authService: AuthService;
  let findUniqueMock: jest.Mock<Promise<AuthUser | null>, [FindUniqueArgs]>;
  let signAsyncMock: jest.Mock<
    Promise<string>,
    [AuthTokenPayload, JwtSignOptions]
  >;

  beforeEach(() => {
    findUniqueMock = jest.fn<Promise<AuthUser | null>, [FindUniqueArgs]>();
    signAsyncMock = jest.fn<
      Promise<string>,
      [AuthTokenPayload, JwtSignOptions]
    >();

    const prismaService = {
      user: {
        findUnique: findUniqueMock,
      },
    } as unknown as PrismaService;

    const jwtService = {
      signAsync: signAsyncMock,
    } as unknown as JwtService;

    const configService = {
      getOrThrow: <T = string>(key: string): T => configValues[key] as T,
    } as ConfigService;

    authService = new AuthService(prismaService, jwtService, configService);
  });

  it('returns JWT tokens when credentials are valid', async () => {
    const user = await createAuthUser();
    findUniqueMock.mockResolvedValue(user);
    signAsyncMock.mockResolvedValueOnce('access-token');
    signAsyncMock.mockResolvedValueOnce('refresh-token');

    const result = await authService.login({
      email: 'admin@madis.com',
      password: 'Password123!',
    });

    expect(result).toEqual({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      user: {
        id: 1,
        email: 'admin@madis.com',
        userName: 'admin',
        role: 'ADMIN',
        permissions: ['ALL'],
      },
    });
    expect(signAsyncMock).toHaveBeenCalledWith(
      {
        sub: user.id,
        email: user.email,
        role: 'ADMIN',
        permissions: ['ALL'],
      },
      {
        secret: 'access-secret',
        expiresIn: '15m',
      },
    );
  });

  it('throws a clear error when email does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'missing@madis.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Aucun compte lié à cette adresse email'),
    );
  });

  it('throws a clear error when password is invalid', async () => {
    findUniqueMock.mockResolvedValue(await createAuthUser());

    await expect(
      authService.login({
        email: 'admin@madis.com',
        password: 'bad-password',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Adresse email ou mot de passe incorrect'),
    );
  });
});

async function createAuthUser(): Promise<AuthUser> {
  const now = new Date();

  return {
    id: 1,
    email: 'admin@madis.com',
    password: await hash('Password123!', 12),
    userName: 'admin',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    roleId: 1,
    role: {
      id: 1,
      label: 'ADMIN',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: null,
      deletedBy: null,
    },
    userPermissions: [
      {
        id: 1,
        userId: 1,
        permissionId: 1,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        deletedAt: null,
        deletedBy: null,
        permission: {
          id: 1,
          label: 'All permissions',
          code: 'ALL',
          descriptions: 'Allows access to all application features.',
          createdBy: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          deletedBy: null,
        },
      },
    ],
  };
}
