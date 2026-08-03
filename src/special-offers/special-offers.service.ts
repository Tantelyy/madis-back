import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignInventorySpecialOfferDto } from './dto/assign-inventory-special-offer.dto';
import { CreateSpecialOfferDto } from './dto/create-special-offer.dto';
import { ListSpecialOffersQueryDto } from './dto/list-special-offers-query.dto';
import { UpdateSpecialOfferDto } from './dto/update-special-offer.dto';
import { InventorySpecialOfferEntity } from './entities/inventory-special-offer.entity';
import { SpecialOfferEntity } from './entities/special-offer.entity';
import { PaginatedSpecialOffers } from './interfaces/paginated-special-offers.interface';
import { PROMOTION_LOCKING_CART_STATUSES } from './utils/promotion-lock.util';

const SPECIAL_OFFER_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const SPECIAL_OFFER_INCLUDE = {
  createdByUser: {
    select: SPECIAL_OFFER_USER_SELECT,
  },
  deletedByUser: {
    select: SPECIAL_OFFER_USER_SELECT,
  },
  inventorySpecialOffers: {
    include: {
      inventory: {
        select: { productId: true },
      },
    },
  },
  _count: {
    select: {
      cartDetails: {
        where: {
          cart: { status: { in: [...PROMOTION_LOCKING_CART_STATUSES] } },
        },
      },
    },
  },
} satisfies Prisma.SpecialOfferInclude;

type SpecialOfferPayload = Prisma.SpecialOfferGetPayload<{
  include: typeof SPECIAL_OFFER_INCLUDE;
}>;

interface SpecialOfferWriteData {
  label: string;
  startDateTime: Date;
  endDateTime: Date;
  value: string | null;
  unit: SpecialOfferUnit | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  type: SpecialOfferType;
}

@Injectable()
export class SpecialOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateSpecialOfferDto,
    userId: number,
  ): Promise<SpecialOfferEntity> {
    this.validateRules(dto);

    const specialOffer = await this.prisma.$transaction(
      async (tx) => {
        await this.ensureProductsAvailableForPeriod(
          dto.productIds,
          new Date(dto.startDateTime),
          new Date(dto.endDateTime),
          undefined,
          tx,
        );
        const inventories = await this.findInventoriesForOffer(
          dto.productIds,
          dto.limitDate,
          tx,
        );

        return tx.specialOffer.create({
          data: {
            ...this.buildSpecialOfferData(dto),
            createdBy: userId,
            inventorySpecialOffers: {
              create: inventories.map((inventory) => ({
                inventoryId: inventory.id,
                limitDate: dto.limitDate ? new Date(dto.limitDate) : null,
              })),
            },
          },
          include: SPECIAL_OFFER_INCLUDE,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return this.mapSpecialOffer(specialOffer);
  }

  async findAll(
    query: ListSpecialOffersQueryDto,
  ): Promise<PaginatedSpecialOffers> {
    const where = this.buildListWhere(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.specialOffer.findMany({
        where,
        include: SPECIAL_OFFER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.specialOffer.count({ where }),
    ]);

    return {
      data: data.map((specialOffer) => this.mapSpecialOffer(specialOffer)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<SpecialOfferEntity> {
    return this.mapSpecialOffer(await this.findOfferOrThrow(id));
  }

  async update(
    id: number,
    dto: UpdateSpecialOfferDto,
  ): Promise<SpecialOfferEntity> {
    this.validateRules(dto);

    const specialOffer = await this.prisma.$transaction(
      async (tx) => {
        const currentOffer = await tx.specialOffer.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            _count: {
              select: {
                cartDetails: {
                  where: {
                    cart: {
                      status: { in: [...PROMOTION_LOCKING_CART_STATUSES] },
                    },
                  },
                },
              },
            },
          },
        });

        if (!currentOffer) {
          throw new NotFoundException('Offre spéciale introuvable.');
        }

        if (currentOffer._count.cartDetails > 0) {
          throw new BadRequestException(
            'Une promotion utilisée dans une vente ne peut plus être modifiée.',
          );
        }

        await this.ensureProductsAvailableForPeriod(
          dto.productIds,
          new Date(dto.startDateTime),
          new Date(dto.endDateTime),
          id,
          tx,
        );
        const inventories = await this.findInventoriesForOffer(
          dto.productIds,
          dto.limitDate,
          tx,
        );

        return tx.specialOffer.update({
          where: { id },
          data: {
            ...this.buildSpecialOfferData(dto),
            inventorySpecialOffers: {
              deleteMany: {},
              create: inventories.map((inventory) => ({
                inventoryId: inventory.id,
                limitDate: dto.limitDate ? new Date(dto.limitDate) : null,
              })),
            },
          },
          include: SPECIAL_OFFER_INCLUDE,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return this.mapSpecialOffer(specialOffer);
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findActiveOfferOrThrow(id);

    await this.prisma.specialOffer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  async assignInventory(
    specialOfferId: number,
    dto: AssignInventorySpecialOfferDto,
  ): Promise<InventorySpecialOfferEntity> {
    return this.prisma.$transaction(async (tx) => {
      const productIds = await this.findOfferProductIds(specialOfferId, tx);
      const inventoryProductId = await this.findInventoryProductId(
        dto.inventoryId,
        tx,
      );

      if (!productIds.includes(inventoryProductId)) {
        throw new BadRequestException(
          "La ligne de stock n'appartient pas à un produit de cette promotion.",
        );
      }

      return tx.inventorySpecialOffer.upsert({
        where: {
          inventoryId_specialOfferId: {
            inventoryId: dto.inventoryId,
            specialOfferId,
          },
        },
        update: {
          limitDate: dto.limitDate ? new Date(dto.limitDate) : null,
        },
        create: {
          inventoryId: dto.inventoryId,
          specialOfferId,
          limitDate: dto.limitDate ? new Date(dto.limitDate) : null,
        },
      });
    });
  }

  async unassignInventory(
    specialOfferId: number,
    inventoryId: number,
  ): Promise<void> {
    const association = await this.prisma.inventorySpecialOffer.findUnique({
      where: {
        inventoryId_specialOfferId: {
          inventoryId,
          specialOfferId,
        },
      },
      select: { id: true },
    });

    if (!association) {
      throw new NotFoundException(
        "Cette offre n'est pas associée à la ligne de stock.",
      );
    }

    await this.prisma.inventorySpecialOffer.delete({
      where: { id: association.id },
    });
  }

  private validateRules(dto: CreateSpecialOfferDto): void {
    const startDateTime = new Date(dto.startDateTime);
    const endDateTime = new Date(dto.endDateTime);

    if (endDateTime <= startDateTime) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }

    if (dto.type === SpecialOfferType.REDUCTION) {
      this.validateReduction(dto);
      return;
    }

    this.validateFreeQuantityOffer(dto);
  }

  private validateReduction(dto: CreateSpecialOfferDto): void {
    if (!this.isDefined(dto.value) || !this.isDefined(dto.unit)) {
      throw new BadRequestException(
        'Une réduction doit définir une valeur et une unité.',
      );
    }

    if (dto.value <= 0) {
      throw new BadRequestException(
        "La valeur d'une réduction doit être supérieure à 0.",
      );
    }

    if (dto.unit === SpecialOfferUnit.PERCENT && dto.value > 100) {
      throw new BadRequestException(
        'Une réduction en pourcentage ne peut pas dépasser 100%.',
      );
    }

    if (this.isDefined(dto.buyQuantity) || this.isDefined(dto.freeQuantity)) {
      throw new BadRequestException(
        'Une réduction ne doit pas définir de quantités achetées ou gratuites.',
      );
    }
  }

  private validateFreeQuantityOffer(dto: CreateSpecialOfferDto): void {
    if (!this.isDefined(dto.buyQuantity) || !this.isDefined(dto.freeQuantity)) {
      throw new BadRequestException(
        'Une offre BUY_X_GET_N doit définir la quantité achetée et la quantité gratuite.',
      );
    }

    if (this.isDefined(dto.value) || this.isDefined(dto.unit)) {
      throw new BadRequestException(
        "Une offre BUY_X_GET_N ne doit pas définir de valeur ni d'unité.",
      );
    }
  }

  private isDefined<T>(value: T | null | undefined): value is T {
    return value !== undefined && value !== null;
  }

  private buildSpecialOfferData(
    dto: CreateSpecialOfferDto,
  ): SpecialOfferWriteData {
    return {
      label: dto.label.trim(),
      startDateTime: new Date(dto.startDateTime),
      endDateTime: new Date(dto.endDateTime),
      value:
        dto.type === SpecialOfferType.REDUCTION
          ? (dto.value?.toFixed(2) ?? null)
          : null,
      unit: dto.type === SpecialOfferType.REDUCTION ? (dto.unit ?? null) : null,
      buyQuantity:
        dto.type === SpecialOfferType.BUY_X_GET_N
          ? (dto.buyQuantity ?? null)
          : null,
      freeQuantity:
        dto.type === SpecialOfferType.BUY_X_GET_N
          ? (dto.freeQuantity ?? null)
          : null,
      type: dto.type,
    };
  }

  private async findActiveOfferOrThrow(
    id: number,
  ): Promise<SpecialOfferPayload> {
    const specialOffer = await this.prisma.specialOffer.findFirst({
      where: { id, deletedAt: null },
      include: SPECIAL_OFFER_INCLUDE,
    });

    if (!specialOffer) {
      throw new NotFoundException('Offre spéciale introuvable.');
    }

    return specialOffer;
  }

  private async findOfferOrThrow(id: number): Promise<SpecialOfferPayload> {
    const specialOffer = await this.prisma.specialOffer.findUnique({
      where: { id },
      include: SPECIAL_OFFER_INCLUDE,
    });

    if (!specialOffer) {
      throw new NotFoundException('Offre spéciale introuvable.');
    }

    return specialOffer;
  }

  private async findInventoriesForOffer(
    productIds: readonly number[],
    limitDate: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: number; productId: number }[]> {
    const uniqueProductIds = [...new Set(productIds)];
    const products = await tx.product.findMany({
      where: { id: { in: uniqueProductIds }, deletedAt: null },
      select: { id: true, name: true },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new NotFoundException(
        'Un ou plusieurs produits sont introuvables.',
      );
    }

    const inventories = await tx.inventory.findMany({
      where: {
        productId: { in: uniqueProductIds },
        expiredAt: limitDate ? { lte: new Date(limitDate) } : undefined,
      },
      select: { id: true, productId: true },
    });
    const productIdsWithInventories = new Set(
      inventories.map(({ productId }) => productId),
    );
    const productsWithoutInventory = products.filter(
      ({ id }) => !productIdsWithInventories.has(id),
    );

    if (productsWithoutInventory.length > 0) {
      throw new BadRequestException(
        `Aucun lot ne correspond aux critères pour : ${productsWithoutInventory
          .map(({ name }) => name)
          .join(', ')}.`,
      );
    }

    return inventories;
  }

  private async findOfferProductIds(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<number[]> {
    const specialOffer = await tx.specialOffer.findFirst({
      where: { id, deletedAt: null },
      select: {
        inventorySpecialOffers: {
          select: {
            inventory: { select: { productId: true } },
          },
        },
      },
    });

    if (!specialOffer) {
      throw new NotFoundException('Offre spéciale introuvable.');
    }

    return [
      ...new Set(
        specialOffer.inventorySpecialOffers.map(
          ({ inventory }) => inventory.productId,
        ),
      ),
    ];
  }

  private async findInventoryProductId(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const inventory = await tx.inventory.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!inventory) {
      throw new NotFoundException('Ligne de stock introuvable.');
    }

    return inventory.productId;
  }

  private async ensureProductsAvailableForPeriod(
    productIds: readonly number[],
    startDateTime: Date,
    endDateTime: Date,
    excludedOfferId: number | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const conflict = await tx.inventorySpecialOffer.findFirst({
      where: {
        inventory: {
          productId: { in: [...new Set(productIds)] },
        },
        specialOffer: {
          id: excludedOfferId ? { not: excludedOfferId } : undefined,
          deletedAt: null,
          startDateTime: { lt: endDateTime },
          endDateTime: { gt: startDateTime },
        },
      },
      include: {
        inventory: {
          select: {
            product: { select: { name: true } },
          },
        },
        specialOffer: { select: { label: true } },
      },
    });

    if (conflict) {
      throw new ConflictException(
        `Le produit ${conflict.inventory.product.name} appartient déjà à la promotion ${conflict.specialOffer.label} sur cette période.`,
      );
    }
  }

  private buildListWhere(
    query: ListSpecialOffersQueryDto,
  ): Prisma.SpecialOfferWhereInput {
    const trimmedSearch = query.search?.trim();
    const validAt = query.validAt ? new Date(query.validAt) : undefined;

    return {
      type: query.type,
      startDateTime: validAt ? { lte: validAt } : undefined,
      endDateTime: validAt ? { gte: validAt } : undefined,
      label: trimmedSearch
        ? { contains: trimmedSearch, mode: 'insensitive' }
        : undefined,
    };
  }

  private mapSpecialOffer(
    specialOffer: SpecialOfferPayload,
  ): SpecialOfferEntity {
    return {
      id: specialOffer.id,
      label: specialOffer.label,
      createdAt: specialOffer.createdAt,
      createdBy: specialOffer.createdBy,
      updatedAt: specialOffer.updatedAt,
      deletedAt: specialOffer.deletedAt,
      deletedBy: specialOffer.deletedBy,
      startDateTime: specialOffer.startDateTime,
      endDateTime: specialOffer.endDateTime,
      value: specialOffer.value?.toFixed(2) ?? null,
      unit: specialOffer.unit,
      buyQuantity: specialOffer.buyQuantity,
      freeQuantity: specialOffer.freeQuantity,
      type: specialOffer.type,
      productIds: [
        ...new Set(
          specialOffer.inventorySpecialOffers.map(
            ({ inventory }) => inventory.productId,
          ),
        ),
      ],
      limitDate: specialOffer.inventorySpecialOffers[0]?.limitDate ?? null,
      isLocked: specialOffer._count.cartDetails > 0,
      createdByUser: specialOffer.createdByUser,
      deletedByUser: specialOffer.deletedByUser,
      inventorySpecialOffers: specialOffer.inventorySpecialOffers.map(
        (association) => ({
          id: association.id,
          inventoryId: association.inventoryId,
          specialOfferId: association.specialOfferId,
          limitDate: association.limitDate,
        }),
      ),
    };
  }
}
