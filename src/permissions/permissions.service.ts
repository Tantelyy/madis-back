import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionEntity } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<PermissionEntity[]> {
    return this.prisma.permission.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        label: 'asc',
      },
    });
  }
}
