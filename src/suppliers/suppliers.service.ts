import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import {
  ListSuppliersQueryDto,
  SortOrder,
  SupplierSortField,
} from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierEntity } from './entities/supplier.entity';
import { PaginatedSuppliers } from './interfaces/paginated-suppliers.interface';

const SUPPLIER_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const SUPPLIER_INCLUDE = {
  createdByUser: {
    select: SUPPLIER_USER_SELECT,
  },
  updatedByUser: {
    select: SUPPLIER_USER_SELECT,
  },
  deletedByUser: {
    select: SUPPLIER_USER_SELECT,
  },
} satisfies Prisma.SupplierInclude;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createSupplierDto: CreateSupplierDto,
    userId: number,
  ): Promise<SupplierEntity> {
    return this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        createdBy: userId,
      },
    });
  }

  async findAll(query: ListSuppliersQueryDto): Promise<PaginatedSuppliers> {
    const where = this.buildListWhere(query.search);
    const skip = (query.page - 1) * query.limit;
    const orderBy = this.buildOrderBy(query.sortBy, query.order);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        include: SUPPLIER_INCLUDE,
        orderBy,
        skip,
        take: query.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<SupplierEntity> {
    return this.findActiveSupplierOrThrow(id);
  }

  async update(
    id: number,
    updateSupplierDto: UpdateSupplierDto,
    userId: number,
  ): Promise<SupplierEntity> {
    await this.findActiveSupplierOrThrow(id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...updateSupplierDto,
        updatedBy: userId,
      },
    });
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findActiveSupplierOrThrow(id);

    await this.prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  private async findActiveSupplierOrThrow(id: number): Promise<SupplierEntity> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: SUPPLIER_INCLUDE,
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }

    return supplier;
  }

  private buildListWhere(search?: string): Prisma.SupplierWhereInput {
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
    };
    const trimmedSearch = search?.trim();

    if (!trimmedSearch) {
      return where;
    }

    return {
      ...where,
      OR: [
        { name: { contains: trimmedSearch, mode: 'insensitive' } },
        { address: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        { phone: { contains: trimmedSearch, mode: 'insensitive' } },
      ],
    };
  }

  private buildOrderBy(
    sortBy: SupplierSortField,
    order: SortOrder,
  ): Prisma.SupplierOrderByWithRelationInput {
    switch (sortBy) {
      case 'updatedAt':
        return { updatedAt: order };
      case 'deletedAt':
        return { deletedAt: order };
      case 'createdAt':
      default:
        return { createdAt: order };
    }
  }
}
