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
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { InventoryEntity } from './entities/inventory.entity';
import { PaginatedInventoryMovements } from './interfaces/paginated-inventory-movements.interface';
import { PaginatedInventories } from './interfaces/paginated-inventories.interface';

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

interface InventoryPrices {
  purchasePrice: string;
  salePrice: string;
  wholesalePrice: string;
}

interface PricingRuleMargins {
  retailAverage: Prisma.Decimal;
  wholesaleAverage: Prisma.Decimal;
}

@Injectable()
export class InventoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createInventoryDto: CreateInventoryDto,
    userId: number,
  ): Promise<InventoryEntity> {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureProductExists(createInventoryDto.productId, tx);
      await this.ensureSupplierExists(createInventoryDto.supplierId, tx);

      const prices = await this.resolvePrices(
        createInventoryDto.purchasePrice,
        createInventoryDto.salePrice,
        createInventoryDto.wholesalePrice,
        tx,
      );

      const inventory = await tx.inventory.create({
        data: {
          productId: createInventoryDto.productId,
          quantity: createInventoryDto.quantity,
          remainingQuantity: createInventoryDto.quantity,
          createdBy: userId,
          supplierId: createInventoryDto.supplierId,
          expiredAt: createInventoryDto.expiredAt
            ? new Date(createInventoryDto.expiredAt)
            : null,
          ...prices,
          inventoryMovements: {
            create: {
              incomingQuantity: createInventoryDto.quantity,
              outgoingQuantity: 0,
              actorId: userId,
              type: InventoryMovementType.INCOMING,
              ...prices,
            },
          },
        },
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
          'La quantite restante ne peut pas etre negative.',
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
      const prices = await this.resolvePrices(
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

  private async resolvePrices(
    purchasePrice: number,
    salePrice: number | undefined,
    wholesalePrice: number | undefined,
    tx: Prisma.TransactionClient,
    fallbackPrices?: {
      salePrice: number;
      wholesalePrice: number;
    },
  ): Promise<InventoryPrices> {
    if (salePrice !== undefined && wholesalePrice !== undefined) {
      return {
        purchasePrice: this.toDecimalPriceString(purchasePrice),
        salePrice: this.toRoundedPriceString(salePrice),
        wholesalePrice: this.toRoundedPriceString(wholesalePrice),
      };
    }

    if (
      fallbackPrices &&
      salePrice === undefined &&
      wholesalePrice === undefined
    ) {
      return {
        purchasePrice: this.toDecimalPriceString(purchasePrice),
        salePrice: this.toRoundedPriceString(fallbackPrices.salePrice),
        wholesalePrice: this.toRoundedPriceString(
          fallbackPrices.wholesalePrice,
        ),
      };
    }

    const pricingRule = await this.findPricingRuleForPurchasePrice(
      purchasePrice,
      tx,
    );

    return {
      purchasePrice: this.toDecimalPriceString(purchasePrice),
      salePrice: this.toRoundedPriceString(
        salePrice ?? purchasePrice + pricingRule.retailAverage.toNumber(),
      ),
      wholesalePrice: this.toRoundedPriceString(
        wholesalePrice ??
          purchasePrice + pricingRule.wholesaleAverage.toNumber(),
      ),
    };
  }

  private async findPricingRuleForPurchasePrice(
    purchasePrice: number,
    tx: Prisma.TransactionClient,
  ): Promise<PricingRuleMargins> {
    const pricingRule = await tx.pricingRule.findFirst({
      where: {
        minPurchasePrice: { lte: purchasePrice },
        maxPurchasePrice: { gte: purchasePrice },
        pricingGrid: {
          status: 'ACTIVE',
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
      },
      select: {
        retailAverage: true,
        wholesaleAverage: true,
      },
      orderBy: {
        minPurchasePrice: 'desc',
      },
    });

    if (!pricingRule) {
      throw new NotFoundException(
        "Aucune tranche de marge active ne correspond au prix d'achat.",
      );
    }

    return pricingRule;
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

  private toDecimalPriceString(value: number): string {
    return value.toFixed(2);
  }

  private toRoundedPriceString(value: number): string {
    return Math.round(value).toFixed(2);
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
