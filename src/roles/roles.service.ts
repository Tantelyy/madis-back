import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEntity } from './entities/role.entity';

const ROLE_INCLUDE = {
  rolePermissions: {
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
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof ROLE_INCLUDE;
}>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoleEntity[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        deletedAt: null,
        label: {
          in: ['ADMIN', 'SELLER'],
        },
      },
      include: ROLE_INCLUDE,
      orderBy: {
        label: 'asc',
      },
    });

    return roles.map((role) => this.toRoleEntity(role));
  }

  private toRoleEntity(role: RoleWithPermissions): RoleEntity {
    return {
      id: role.id,
      label: role.label,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      deletedAt: role.deletedAt,
      createdBy: role.createdBy,
      deletedBy: role.deletedBy,
      permissions: role.rolePermissions.map(
        (rolePermission) => rolePermission.permission,
      ),
    };
  }
}
