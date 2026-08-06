import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import {
  InventorySortField,
  InventorySortOrder,
  ListInventoriesQueryDto,
  ListInventoryMovementsQueryDto,
} from './dto/list-inventories-query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  ListStockSummaryQueryDto,
  type StockSummarySortField,
  type StockSummarySortOrder,
} from './dto/list-stock-summary-query.dto';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { InventoryEntity } from './entities/inventory.entity';
import { InventoryFormOptions } from './interfaces/inventory-form-options.interface';
import { PaginatedInventoryMovements } from './interfaces/paginated-inventory-movements.interface';
import { PaginatedInventories } from './interfaces/paginated-inventories.interface';
import { PaginatedStockSummary } from './interfaces/paginated-stock-summary.interface';
import type { StockSummaryEntity } from './entities/stock-summary.entity';
import { InventoryPricingService } from './inventory-pricing.service';
import { buildIncomingInventoryData } from './utils/inventory-write.util';

const INVENTORY_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const INVENTORY_PRODUCT_INCLUDE = {
  mark: true,
  specification: true,
  format: true,
  productType: true,
} satisfies Prisma.ProductInclude;

const INVENTORY_INCLUDE = {
  product: {
    include: INVENTORY_PRODUCT_INCLUDE,
  },
  supplier: true,
  createdByUser: {
    select: INVENTORY_USER_SELECT,
  },
  updatedByUser: {
    select: INVENTORY_USER_SELECT,
  },
} satisfies Prisma.InventoryInclude;

type InventoryPayload = Prisma.InventoryGetPayload<{
  include: typeof INVENTORY_INCLUDE;
}>;

const INVENTORY_MOVEMENT_INCLUDE = {
  actor: {
    select: INVENTORY_USER_SELECT,
  },
  inventory: {
    include: INVENTORY_INCLUDE,
  },
} satisfies Prisma.InventoryMovementInclude;

type InventoryMovementPayload = Prisma.InventoryMovementGetPayload<{
  include: typeof INVENTORY_MOVEMENT_INCLUDE;
}>;

@Injectable()
export class InventoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPricingService: InventoryPricingService,
  ) {}

  async create(
    createInventoryDto: CreateInventoryDto,
    userId: number,
  ): Promise<InventoryEntity> {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureProductExists(createInventoryDto.productId, tx);
      await this.ensureSupplierExists(createInventoryDto.supplierId, tx);

      const prices = await this.inventoryPricingService.resolvePrices(
        createInventoryDto.purchasePrice,
        createInventoryDto.salePrice,
        createInventoryDto.wholesalePrice,
        tx,
      );

      const inventory = await tx.inventory.create({
        data: buildIncomingInventoryData({
          productId: createInventoryDto.productId,
          quantity: createInventoryDto.quantity,
          actorId: userId,
          supplierId: createInventoryDto.supplierId,
          expiredAt: createInventoryDto.expiredAt
            ? new Date(createInventoryDto.expiredAt)
            : null,
          ...prices,
        }),
        include: INVENTORY_INCLUDE,
      });

      return this.mapInventory(inventory);
    });
  }

  async findAll(query: ListInventoriesQueryDto): Promise<PaginatedInventories> {
    const where = this.buildListWhere(query.search);
    const skip = (query.page - 1) * query.limit;
    const orderBy = this.buildOrderBy(query.sortBy, query.order);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        include: INVENTORY_INCLUDE,
        orderBy,
        skip,
        take: query.limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      data: data.map((inventory) => this.mapInventory(inventory)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findStockSummary(
    query: ListStockSummaryQueryDto,
  ): Promise<PaginatedStockSummary> {
    const trimmedSearch = query.search?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: trimmedSearch
          ? [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { reference: { contains: trimmedSearch, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: {
        id: true,
        name: true,
        reference: true,
        inventories: {
          select: {
            id: true,
            expiredAt: true,
            remainingQuantity: true,
          },
          orderBy: [{ expiredAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    const summaries = products.map<StockSummaryEntity>((product) => ({
      productId: product.id,
      name: product.name,
      reference: product.reference,
      remainingQuantity: product.inventories.reduce(
        (total, inventory) => total + inventory.remainingQuantity,
        0,
      ),
      lots: product.inventories.map((inventory) => ({
        id: inventory.id,
        expiredAt: inventory.expiredAt,
        remainingQuantity: inventory.remainingQuantity,
      })),
    }));

    summaries.sort((first, second) =>
      this.compareStockSummaries(first, second, query.sortBy, query.order),
    );

    const total = summaries.length;
    const skip = (query.page - 1) * query.limit;

    return {
      data: summaries.slice(skip, skip + query.limit),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private compareStockSummaries(
    first: StockSummaryEntity,
    second: StockSummaryEntity,
    sortBy: StockSummarySortField,
    order: StockSummarySortOrder,
  ): number {
    const direction = order === 'asc' ? 1 : -1;
    const comparison =
      sortBy === 'remainingQuantity'
        ? first.remainingQuantity - second.remainingQuantity
        : first[sortBy].localeCompare(second[sortBy], 'fr', {
            sensitivity: 'base',
          });

    return comparison * direction;
  }

  async findFormOptions(): Promise<InventoryFormOptions> {
    const [products, suppliers] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          reference: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { products, suppliers };
  }

  async findAllMovements(
    query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovements> {
    return this.findMovements(query, this.buildMovementListWhere(query));
  }

  async findInventoryMovements(
    inventoryId: number,
    query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovements> {
    await this.ensureInventoryExists(inventoryId);

    return this.findMovements(
      query,
      this.buildMovementListWhere(query, inventoryId),
    );
  }

  async update(
    id: number,
    updateInventoryDto: UpdateInventoryDto,
    userId: number,
  ): Promise<InventoryEntity> {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.findInventoryOrThrow(id, tx);

      if (updateInventoryDto.productId) {
        await this.ensureProductExists(updateInventoryDto.productId, tx);
      }

      if (updateInventoryDto.supplierId) {
        await this.ensureSupplierExists(updateInventoryDto.supplierId, tx);
      }

      const quantity = updateInventoryDto.quantity ?? inventory.quantity;
      const quantityDelta = quantity - inventory.quantity;
      const remainingQuantity = inventory.remainingQuantity + quantityDelta;

      if (remainingQuantity < 0) {
        throw new BadRequestException(
          'La quantité restante ne peut pas être négative.',
        );
      }

      const purchasePrice =
        updateInventoryDto.purchasePrice ?? inventory.purchasePrice.toNumber();
      const fallbackPrices =
        updateInventoryDto.purchasePrice === undefined
          ? {
              salePrice: inventory.salePrice.toNumber(),
              wholesalePrice: inventory.wholesalePrice.toNumber(),
            }
          : undefined;
      const prices = await this.inventoryPricingService.resolvePrices(
        purchasePrice,
        updateInventoryDto.salePrice,
        updateInventoryDto.wholesalePrice,
        tx,
        fallbackPrices,
      );

      const updatedInventory = await tx.inventory.update({
        where: { id },
        data: {
          productId: updateInventoryDto.productId,
          quantity,
          remainingQuantity,
          supplierId: updateInventoryDto.supplierId,
          expiredAt:
            updateInventoryDto.expiredAt === undefined
              ? undefined
              : updateInventoryDto.expiredAt
                ? new Date(updateInventoryDto.expiredAt)
                : null,
          updatedBy: userId,
          ...prices,
          inventoryMovements: {
            create: {
              incomingQuantity: Math.max(quantityDelta, 0),
              outgoingQuantity: Math.max(-quantityDelta, 0),
              actorId: userId,
              type: InventoryMovementType.ADJUSTMENT,
              ...prices,
            },
          },
        },
        include: INVENTORY_INCLUDE,
      });

      return this.mapInventory(updatedInventory);
    });
  }

  private async findInventoryOrThrow(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryPayload> {
    const inventory = await tx.inventory.findUnique({
      where: { id },
      include: INVENTORY_INCLUDE,
    });

    if (!inventory) {
      throw new NotFoundException('Ligne de stock introuvable.');
    }

    return inventory;
  }

  private async ensureInventoryExists(id: number): Promise<void> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!inventory) {
      throw new NotFoundException('Ligne de stock introuvable.');
    }
  }

  private async ensureProductExists(
    productId: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!product) {
      throw new BadRequestException('Le produit est introuvable.');
    }
  }

  private async ensureSupplierExists(
    supplierId: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const supplier = await tx.supplier.findFirst({
      where: {
        id: supplierId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!supplier) {
      throw new BadRequestException('Le fournisseur est introuvable.');
    }
  }

  private buildListWhere(search?: string): Prisma.InventoryWhereInput {
    const trimmedSearch = search?.trim();

    if (!trimmedSearch) {
      return {};
    }

    return {
      OR: [
        { product: { name: { contains: trimmedSearch, mode: 'insensitive' } } },
        {
          product: {
            reference: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
        {
          supplier: { name: { contains: trimmedSearch, mode: 'insensitive' } },
        },
      ],
    };
  }

  private buildMovementListWhere(
    query: ListInventoryMovementsQueryDto,
    inventoryId?: number,
  ): Prisma.InventoryMovementWhereInput {
    const where: Prisma.InventoryMovementWhereInput = {
      inventoryId: inventoryId ?? query.inventoryId,
      type: query.type,
    };
    const trimmedSearch = query.search?.trim();

    if (!trimmedSearch) {
      return where;
    }

    return {
      ...where,
      OR: [
        {
          inventory: {
            product: {
              name: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          inventory: {
            product: {
              reference: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          inventory: {
            supplier: {
              name: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          actor: {
            userName: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
        {
          actor: {
            email: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
      ],
    };
  }

  private buildOrderBy(
    sortBy: InventorySortField,
    order: InventorySortOrder,
  ): Prisma.InventoryOrderByWithRelationInput {
    switch (sortBy) {
      case 'quantity':
        return { quantity: order };
      case 'remainingQuantity':
        return { remainingQuantity: order };
      case 'purchasePrice':
        return { purchasePrice: order };
      case 'salePrice':
        return { salePrice: order };
      case 'wholesalePrice':
        return { wholesalePrice: order };
      case 'expiredAt':
        return { expiredAt: order };
      case 'updatedAt':
        return { updatedAt: order };
      case 'createdAt':
      default:
        return { createdAt: order };
    }
  }

  private async findMovements(
    query: ListInventoryMovementsQueryDto,
    where: Prisma.InventoryMovementWhereInput = {},
  ): Promise<PaginatedInventoryMovements> {
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: INVENTORY_MOVEMENT_INCLUDE,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: query.limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: data.map((movement) => this.mapInventoryMovement(movement)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private mapInventory(inventory: InventoryPayload): InventoryEntity {
    return {
      id: inventory.id,
      productId: inventory.productId,
      quantity: inventory.quantity,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
      createdBy: inventory.createdBy,
      purchasePrice: inventory.purchasePrice.toFixed(2),
      salePrice: inventory.salePrice.toFixed(2),
      updatedBy: inventory.updatedBy,
      supplierId: inventory.supplierId,
      wholesalePrice: inventory.wholesalePrice.toFixed(2),
      remainingQuantity: inventory.remainingQuantity,
      expiredAt: inventory.expiredAt,
      product: inventory.product,
      supplier: inventory.supplier,
      createdByUser: inventory.createdByUser,
      updatedByUser: inventory.updatedByUser,
    };
  }

  private mapInventoryMovement(
    movement: InventoryMovementPayload,
  ): InventoryMovementEntity {
    return {
      id: movement.id,
      inventoryId: movement.inventoryId,
      incomingQuantity: movement.incomingQuantity,
      outgoingQuantity: movement.outgoingQuantity,
      actorId: movement.actorId,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
      purchasePrice: movement.purchasePrice.toFixed(2),
      salePrice: movement.salePrice.toFixed(2),
      type: movement.type,
      wholesalePrice: movement.wholesalePrice.toFixed(2),
      cartId: movement.cartId,
      actor: movement.actor,
      inventory: this.mapInventory(movement.inventory),
    };
  }
}
