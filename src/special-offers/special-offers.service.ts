import {
  BadRequestException,
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
  inventorySpecialOffers: true,
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

    const specialOffer = await this.prisma.specialOffer.create({
      data: {
        ...this.buildSpecialOfferData(dto),
        createdBy: userId,
      },
      include: SPECIAL_OFFER_INCLUDE,
    });

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
    return this.mapSpecialOffer(await this.findActiveOfferOrThrow(id));
  }

  async update(
    id: number,
    dto: UpdateSpecialOfferDto,
  ): Promise<SpecialOfferEntity> {
    await this.findActiveOfferOrThrow(id);
    this.validateRules(dto);

    const specialOffer = await this.prisma.specialOffer.update({
      where: { id },
      data: this.buildSpecialOfferData(dto),
      include: SPECIAL_OFFER_INCLUDE,
    });

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
      await this.ensureOfferExists(specialOfferId, tx);
      await this.ensureInventoryExists(dto.inventoryId, tx);

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
        "Cette offre n'est pas associee a la ligne de stock.",
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
        'La date de fin doit etre posterieure a la date de debut.',
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
        'Une reduction doit definir une valeur et une unite.',
      );
    }

    if (dto.value <= 0) {
      throw new BadRequestException(
        "La valeur d'une reduction doit etre superieure a 0.",
      );
    }

    if (dto.unit === SpecialOfferUnit.PERCENT && dto.value > 100) {
      throw new BadRequestException(
        'Une reduction en pourcentage ne peut pas depasser 100%.',
      );
    }

    if (this.isDefined(dto.buyQuantity) || this.isDefined(dto.freeQuantity)) {
      throw new BadRequestException(
        'Une reduction ne doit pas definir de quantites achetee ou gratuite.',
      );
    }
  }

  private validateFreeQuantityOffer(dto: CreateSpecialOfferDto): void {
    if (!this.isDefined(dto.buyQuantity) || !this.isDefined(dto.freeQuantity)) {
      throw new BadRequestException(
        'Une offre BUY_X_GET_N doit definir les quantites achetee et gratuite.',
      );
    }

    if (this.isDefined(dto.value) || this.isDefined(dto.unit)) {
      throw new BadRequestException(
        "Une offre BUY_X_GET_N ne doit pas definir de valeur ni d'unite.",
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
      throw new NotFoundException('Offre speciale introuvable.');
    }

    return specialOffer;
  }

  private async ensureOfferExists(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const specialOffer = await tx.specialOffer.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!specialOffer) {
      throw new NotFoundException('Offre speciale introuvable.');
    }
  }

  private async ensureInventoryExists(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const inventory = await tx.inventory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!inventory) {
      throw new NotFoundException('Ligne de stock introuvable.');
    }
  }

  private buildListWhere(
    query: ListSpecialOffersQueryDto,
  ): Prisma.SpecialOfferWhereInput {
    const trimmedSearch = query.search?.trim();

    return {
      deletedAt: null,
      type: query.type,
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
      createdByUser: specialOffer.createdByUser,
      deletedByUser: specialOffer.deletedByUser,
      inventorySpecialOffers: specialOffer.inventorySpecialOffers,
    };
  }
}
