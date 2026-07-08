import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, type UserRole } from './dto/create-user.dto';
import {
  ListUsersQueryDto,
  SortOrder,
  UserSortField,
} from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { PaginatedUsers } from './interfaces/paginated-users.interface';

const PASSWORD_SALT_ROUNDS = 12;

const USER_INCLUDE = {
  role: true,
  userPermissions: {
    where: {
      deletedAt: null,
      permission: {
        deletedAt: null,
      },
    },
    include: {
      permission: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{
  include: typeof USER_INCLUDE;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    await this.ensureEmailIsAvailable(createUserDto.email);

    const role = await this.findRoleOrThrow(createUserDto.role);
    const permissionIds = await this.findPermissionIdsOrThrow(
      createUserDto.permissions,
    );
    const password = await hash(createUserDto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email.trim().toLowerCase(),
        userName: createUserDto.userName.trim(),
        password,
        roleId: role.id,
        userPermissions: {
          create: permissionIds.map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: USER_INCLUDE,
    });

    return this.toUserEntity(user);
  }

  async findAll(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const where = this.buildListWhere(query.search);
    const skip = (query.page - 1) * query.limit;
    const orderBy = this.buildOrderBy(query.sortBy, query.order);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: USER_INCLUDE,
        orderBy,
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((user) => this.toUserEntity(user)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<UserEntity> {
    return this.toUserEntity(await this.findActiveUserOrThrow(id));
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    const currentUser = await this.findActiveUserOrThrow(id);
    const email = updateUserDto.email?.trim().toLowerCase();
    const role = updateUserDto.role
      ? await this.findRoleOrThrow(updateUserDto.role)
      : undefined;
    const permissionIds = updateUserDto.permissions
      ? await this.findPermissionIdsOrThrow(updateUserDto.permissions)
      : undefined;

    if (email && email !== currentUser.email) {
      await this.ensureEmailIsAvailable(email, id);
    }

    const password = updateUserDto.password
      ? await hash(updateUserDto.password, PASSWORD_SALT_ROUNDS)
      : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.userPermission.deleteMany({
          where: {
            userId: id,
          },
        });
      }

      return tx.user.update({
        where: { id },
        data: {
          email,
          userName: updateUserDto.userName?.trim(),
          password,
          roleId: role?.id,
          userPermissions: permissionIds
            ? {
                create: permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              }
            : undefined,
        },
        include: USER_INCLUDE,
      });
    });

    return this.toUserEntity(user);
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Vous ne pouvez pas desactiver votre propre compte.',
      );
    }

    await this.findActiveUserOrThrow(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async findActiveUserOrThrow(id: number): Promise<UserWithAccess> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: USER_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException('Compte introuvable.');
    }

    return user;
  }

  private async ensureEmailIsAvailable(
    email: string,
    ignoredUserId?: number,
  ): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    if (existingUser && existingUser.id !== ignoredUserId) {
      throw new ConflictException('Cette adresse email est deja utilisee.');
    }
  }

  private async findRoleOrThrow(roleLabel: UserRole): Promise<{ id: number }> {
    const role = await this.prisma.role.findFirst({
      where: {
        label: roleLabel,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!role) {
      throw new BadRequestException('Le role selectionne est introuvable.');
    }

    return role;
  }

  private async findPermissionIdsOrThrow(codes: string[]): Promise<number[]> {
    const uniqueCodes = Array.from(new Set(codes));
    const permissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: uniqueCodes,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (permissions.length !== uniqueCodes.length) {
      throw new BadRequestException(
        'Une ou plusieurs permissions selectionnees sont invalides.',
      );
    }

    return permissions.map((permission) => permission.id);
  }

  private buildListWhere(search?: string): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };
    const trimmedSearch = search?.trim();

    if (!trimmedSearch) {
      return where;
    }

    return {
      ...where,
      OR: [
        { userName: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        {
          role: {
            label: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
      ],
    };
  }

  private buildOrderBy(
    sortBy: UserSortField,
    order: SortOrder,
  ): Prisma.UserOrderByWithRelationInput {
    switch (sortBy) {
      case 'userName':
        return { userName: order };
      case 'email':
        return { email: order };
      case 'updatedAt':
        return { updatedAt: order };
      case 'createdAt':
      default:
        return { createdAt: order };
    }
  }

  private toUserEntity(user: UserWithAccess): UserEntity {
    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      roleId: user.roleId,
      role: user.role,
      permissions: user.userPermissions.map(
        (userPermission) => userPermission.permission,
      ),
    };
  }
}
