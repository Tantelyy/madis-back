import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { CartEntity } from '../carts/entities/cart.entity';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { PaginatedSales } from './interfaces/paginated-sales.interface';
import {
  AppliedSalePricing,
  calculateSalePricing,
} from './utils/promotion-calculator.util';

const SALE_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const SALE_INCLUDE = {
  seller: {
    select: SALE_USER_SELECT,
  },
  validator: {
    select: SALE_USER_SELECT,
  },
  cartDetails: true,
  inventoryMovements: {
    include: {
      actor: {
        select: SALE_USER_SELECT,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.CartInclude;

const SALE_INVENTORY_INCLUDE = {
  inventorySpecialOffers: {
    include: {
      specialOffer: true,
    },
  },
} satisfies Prisma.InventoryInclude;

type SalePayload = Prisma.CartGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

type SaleInventoryPayload = Prisma.InventoryGetPayload<{
  include: typeof SALE_INVENTORY_INCLUDE;
}>;

interface PreparedSaleItem {
  input: CreateSaleItemDto;
  inventory: SaleInventoryPayload;
  pricing: AppliedSalePricing;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSaleDto, userId: number): Promise<CartEntity> {
    this.ensureUniqueInventories(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const inventories = await tx.inventory.findMany({
        where: {
          id: { in: dto.items.map((item) => item.inventoryId) },
        },
        include: SALE_INVENTORY_INCLUDE,
      });
      const inventoryById = new Map(
        inventories.map((inventory) => [inventory.id, inventory]),
      );
      const preparedItems = dto.items.map((item) =>
        this.prepareSaleItem(item, inventoryById, now),
      );
      const totalPrice = preparedItems.reduce(
        (total, item) => total.plus(item.pricing.totalPrice),
        new Prisma.Decimal(0),
      );

      const cart = await tx.cart.create({
        data: {
          soldBy: userId,
          status: CartStatus.VALIDATED,
          validatedBy: userId,
          totalPrice: totalPrice.toFixed(2),
          customerName: dto.customerName.trim(),
          customerContact: dto.customerContact.trim(),
          customerAddress: dto.customerAddress.trim(),
          paymentMethod: null,
          cartDetails: {
            create: preparedItems.map(({ input, pricing }) => ({
              inventoryId: input.inventoryId,
              quantity: input.quantity,
              freeQuantity: pricing.freeQuantity,
              baseUnitPrice: pricing.baseUnitPrice.toFixed(2),
              finalUnitPrice: pricing.finalUnitPrice.toFixed(2),
              discountAmount: pricing.discountAmount?.toFixed(2) ?? null,
              wholesale: input.wholesale,
              specialOfferId: pricing.specialOfferId,
            })),
          },
        },
        select: { id: true },
      });

      for (const item of preparedItems) {
        await this.recordStockOutput(tx, item, cart.id, userId);
      }

      return this.findSaleInTransaction(cart.id, tx);
    });
  }

  async findAll(query: ListSalesQueryDto): Promise<PaginatedSales> {
    const where = this.buildListWhere(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cart.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.cart.count({ where }),
    ]);

    return {
      data: data.map((sale) => this.mapSale(sale)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<CartEntity> {
    const sale = await this.prisma.cart.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }

    return this.mapSale(sale);
  }

  async pay(id: number, paymentMethod: PaymentMethod): Promise<CartEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: {
          id,
          status: CartStatus.VALIDATED,
        },
        data: {
          status: CartStatus.PAID,
          paymentMethod,
        },
      });

      if (updated.count === 0) {
        await this.throwInvalidSaleTransition(id, CartStatus.VALIDATED, tx);
      }

      return this.findSaleInTransaction(id, tx);
    });
  }

  async refund(
    id: number,
    reason: string,
    userId: number,
  ): Promise<CartEntity> {
    return this.reverseSale(
      id,
      reason,
      userId,
      CartStatus.PAID,
      CartStatus.REFUNDED,
      InventoryMovementType.REFUND,
    );
  }

  async cancel(
    id: number,
    reason: string,
    userId: number,
  ): Promise<CartEntity> {
    return this.reverseSale(
      id,
      reason,
      userId,
      CartStatus.VALIDATED,
      CartStatus.CANCELLED,
      InventoryMovementType.CANCELLATION,
    );
  }

  private async reverseSale(
    id: number,
    reason: string,
    userId: number,
    expectedStatus: CartStatus,
    targetStatus: CartStatus,
    movementType: InventoryMovementType,
  ): Promise<CartEntity> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id },
        include: {
          cartDetails: {
            include: { inventory: true },
          },
        },
      });

      if (!cart) {
        throw new NotFoundException('Vente introuvable.');
      }

      const updated = await tx.cart.updateMany({
        where: { id, status: expectedStatus },
        data: {
          status: targetStatus,
          reason: reason.trim(),
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          `Une vente au statut ${cart.status} ne peut pas effectuer cette action.`,
        );
      }

      for (const detail of cart.cartDetails) {
        const restoredQuantity = detail.quantity + (detail.freeQuantity ?? 0);

        await tx.inventory.update({
          where: { id: detail.inventoryId },
          data: {
            remainingQuantity: { increment: restoredQuantity },
          },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryId: detail.inventoryId,
            incomingQuantity: restoredQuantity,
            outgoingQuantity: 0,
            actorId: userId,
            type: movementType,
            purchasePrice: detail.inventory.purchasePrice,
            salePrice: detail.inventory.salePrice,
            wholesalePrice: detail.inventory.wholesalePrice,
            cartId: id,
          },
        });
      }

      return this.findSaleInTransaction(id, tx);
    });
  }

  private prepareSaleItem(
    input: CreateSaleItemDto,
    inventoryById: ReadonlyMap<number, SaleInventoryPayload>,
    now: Date,
  ): PreparedSaleItem {
    const inventory = inventoryById.get(input.inventoryId);

    if (!inventory) {
      throw new NotFoundException(
        `Ligne de stock ${input.inventoryId} introuvable.`,
      );
    }

    if (inventory.expiredAt && inventory.expiredAt < now) {
      throw new BadRequestException(
        `La ligne de stock ${inventory.id} est expiree.`,
      );
    }

    const offers = inventory.inventorySpecialOffers
      .filter((association) => this.isOfferActive(association, now))
      .map(({ specialOffer }) => specialOffer);
    const baseUnitPrice = input.wholesale
      ? inventory.wholesalePrice
      : inventory.salePrice;
    const pricing = calculateSalePricing(baseUnitPrice, input.quantity, offers);

    if (inventory.remainingQuantity < pricing.stockQuantity) {
      throw new ConflictException(
        `Le stock disponible est insuffisant pour la ligne ${inventory.id}.`,
      );
    }

    return { input, inventory, pricing };
  }

  private isOfferActive(
    association: SaleInventoryPayload['inventorySpecialOffers'][number],
    now: Date,
  ): boolean {
    const { specialOffer, limitDate } = association;

    return (
      specialOffer.deletedAt === null &&
      specialOffer.startDateTime <= now &&
      specialOffer.endDateTime >= now &&
      (limitDate === null || limitDate >= now)
    );
  }

  private async recordStockOutput(
    tx: Prisma.TransactionClient,
    item: PreparedSaleItem,
    cartId: number,
    userId: number,
  ): Promise<void> {
    const updated = await tx.inventory.updateMany({
      where: {
        id: item.inventory.id,
        remainingQuantity: { gte: item.pricing.stockQuantity },
      },
      data: {
        remainingQuantity: { decrement: item.pricing.stockQuantity },
      },
    });

    if (updated.count === 0) {
      throw new ConflictException(
        `Le stock disponible est insuffisant pour la ligne ${item.inventory.id}.`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: item.inventory.id,
        incomingQuantity: 0,
        outgoingQuantity: item.pricing.stockQuantity,
        actorId: userId,
        type: InventoryMovementType.SALE,
        purchasePrice: item.inventory.purchasePrice,
        salePrice: item.inventory.salePrice,
        wholesalePrice: item.inventory.wholesalePrice,
        cartId,
      },
    });
  }

  private ensureUniqueInventories(items: readonly CreateSaleItemDto[]): void {
    const inventoryIds = new Set(items.map((item) => item.inventoryId));

    if (inventoryIds.size !== items.length) {
      throw new BadRequestException(
        "Une ligne de stock ne peut apparaitre qu'une fois dans une vente.",
      );
    }
  }

  private async throwInvalidSaleTransition(
    id: number,
    expectedStatus: CartStatus,
    tx: Prisma.TransactionClient,
  ): Promise<never> {
    const cart = await tx.cart.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!cart) {
      throw new NotFoundException('Vente introuvable.');
    }

    throw new BadRequestException(
      `La vente doit avoir le statut ${expectedStatus} pour effectuer cette action.`,
    );
  }

  private async findSaleInTransaction(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<CartEntity> {
    const sale = await tx.cart.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }

    return this.mapSale(sale);
  }

  private buildListWhere(query: ListSalesQueryDto): Prisma.CartWhereInput {
    const trimmedSearch = query.search?.trim();

    return {
      status: query.status,
      paymentMethod: query.paymentMethod,
      OR: trimmedSearch
        ? [
            {
              customerName: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              customerContact: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              seller: {
                userName: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
  }

  private mapSale(sale: SalePayload): CartEntity {
    return {
      id: sale.id,
      soldBy: sale.soldBy,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      status: sale.status,
      validatedBy: sale.validatedBy,
      totalPrice: sale.totalPrice.toFixed(2),
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      customerAddress: sale.customerAddress,
      paymentMethod: sale.paymentMethod,
      reason: sale.reason,
      seller: sale.seller,
      validator: sale.validator,
      cartDetails: sale.cartDetails.map((detail) => ({
        id: detail.id,
        cartId: detail.cartId,
        inventoryId: detail.inventoryId,
        quantity: detail.quantity,
        freeQuantity: detail.freeQuantity,
        baseUnitPrice: detail.baseUnitPrice.toFixed(2),
        finalUnitPrice: detail.finalUnitPrice.toFixed(2),
        discountAmount: detail.discountAmount?.toFixed(2) ?? null,
        wholesale: detail.wholesale,
        specialOfferId: detail.specialOfferId,
      })),
      inventoryMovements: sale.inventoryMovements.map((movement) => ({
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
      })),
    };
  }
}
